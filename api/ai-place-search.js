// api/ai-place-search.js - AI 자연어 기반 장소 검색
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;

  if (!GEMINI_API_KEY || !KAKAO_API_KEY) {
    return res.status(500).json({ 
      message: 'API 키가 설정되지 않았습니다.',
      debug: { gemini: !!GEMINI_API_KEY, kakao: !!KAKAO_API_KEY }
    });
  }

  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

  try {
    const { userMessage } = req.body;

    // 1단계: AI가 사용자 메시지를 분석하여 검색 키워드 추출
    const analysisPrompt = `
    사용자의 메시지를 분석하여 장소 검색에 필요한 정보를 추출해주세요.

    사용자 메시지: "${userMessage}"

    다음 JSON 형식으로 응답해주세요:
    {
        "location": "지역명 (예: 대구, 서울 강남, 부산 해운대)",
        "keywords": ["검색키워드1", "검색키워드2", "검색키워드3"],
        "category": "카테고리 (카페/음식점/관광명소/문화시설/쇼핑/공원 중 하나)",
        "intent": "사용자 의도 요약",
        "needsRecommendation": true
    }

    예시:
    - "대구에 피크닉하기 좋은곳 추천해줘" → location: "대구", keywords: ["공원", "피크닉", "야외"], category: "공원"
    - "홍대 맛집 알려줘" → location: "홍대", keywords: ["맛집", "레스토랑"], category: "음식점"
    - "부산 카페 추천" → location: "부산", keywords: ["카페", "커피숍"], category: "카페"
    `;

    // AI 분석 요청
    const analysisResponse = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: analysisPrompt
          }]
        }]
      })
    });

    if (!analysisResponse.ok) {
      throw new Error(`AI 분석 실패: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const analysisText = analysisData.candidates[0].content.parts[0].text;
    
    const analysisJsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!analysisJsonMatch) {
      throw new Error('AI 응답 파싱 실패');
    }
    
    const analysis = JSON.parse(analysisJsonMatch[0]);

    // 2단계: 각 키워드로 카카오맵 검색
    const allPlaces = [];
    const categoryCode = getCategoryCode(analysis.category);

    for (const keyword of analysis.keywords) {
      const searchQuery = analysis.location ? `${analysis.location} ${keyword}` : keyword;
      const searchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}&size=10&sort=accuracy`;

      const kakaoResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
      });

      if (kakaoResponse.ok) {
        const data = await kakaoResponse.json();
        const places = data.documents.map(place => ({
          name: place.place_name,
          category: place.category_name,
          address: place.road_address_name || place.address_name,
          phone: place.phone,
          url: place.place_url,
          coordinates: {
            lat: parseFloat(place.y),
            lng: parseFloat(place.x)
          },
          keyword: keyword,
          distance: place.distance
        }));
        allPlaces.push(...places);
      }
    }

    // 3단계: AI가 최적의 3곳 선정
    if (allPlaces.length > 0) {
      const selectionPrompt = `
      사용자가 "${userMessage}"라고 요청했습니다.
      
      다음 장소들 중에서 사용자 요청에 가장 적합한 3곳을 선정해주세요:
      ${allPlaces.map((place, index) => `${index + 1}. ${place.name} - ${place.category} (${place.address})`).join('\n')}

      다음 JSON 형식으로 응답해주세요:
      {
        "selectedIndexes": [0, 5, 8],
        "reason": "선정 이유 설명",
        "aiResponse": "사용자에게 보여줄 친근한 응답 메시지"
      }

      선정 기준:
      1. 사용자 요청과의 관련성
      2. 장소의 다양성
      3. 접근성 및 인기도
      `;

      const selectionResponse = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: selectionPrompt
            }]
          }]
        })
      });

      if (selectionResponse.ok) {
        const selectionData = await selectionResponse.json();
        const selectionText = selectionData.candidates[0].content.parts[0].text;
        
        const selectionJsonMatch = selectionText.match(/\{[\s\S]*\}/);
        if (selectionJsonMatch) {
          const selection = JSON.parse(selectionJsonMatch[0]);
          const selectedPlaces = selection.selectedIndexes
            .filter(index => index < allPlaces.length)
            .map(index => allPlaces[index])
            .slice(0, 3);

          return res.status(200).json({
            success: true,
            places: selectedPlaces,
            aiResponse: selection.aiResponse,
            analysis: analysis,
            totalFound: allPlaces.length
          });
        }
      }
    }

    // 검색 결과가 없거나 AI 선정 실패 시 상위 3개 반환
    const topPlaces = allPlaces.slice(0, 3);
    
    res.status(200).json({
      success: true,
      places: topPlaces,
      aiResponse: analysis.intent ? `${analysis.intent}에 대한 검색 결과입니다. 아래 장소들을 확인해보세요!` : "검색 결과를 확인해보세요!",
      analysis: analysis,
      totalFound: allPlaces.length
    });

  } catch (error) {
    console.error('AI 장소 검색 오류:', error);
    res.status(500).json({ 
      message: '장소 검색 중 오류가 발생했습니다.',
      error: error.message 
    });
  }
}

function getCategoryCode(category) {
  const categoryMap = {
    '카페': 'CE7',
    '음식점': 'FD6',
    '관광명소': 'AT4',
    '문화시설': 'CT1',
    '쇼핑': 'MT1',
    '공원': 'AT4'
  };
  return categoryMap[category] || '';
}
