// api/generate-course.js
export default async function handler(req, res) {
  // CORS 헤더 설정
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

  const API_KEY = process.env.GEMINI_API_KEY;
  const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
  
  if (!API_KEY || !KAKAO_API_KEY) {
    return res.status(500).json({ message: 'API 키가 설정되지 않았습니다.' });
  }

  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

  try {
    const { formData } = req.body;
    
    function getBudgetText(budget) {
      switch(budget) {
        case 'low': return '5만원 이하';
        case 'medium': return '5-10만원';
        case 'high': return '10만원 이상';
        default: return '제한없음';
      }
    }

    // 카테고리 매핑 함수
    function getCategoryCode(activity) {
      const categoryMap = {
        '카페': 'CE7',
        '음식점': 'FD6',
        '관광명소': 'AT4',
        '문화시설': 'CT1',
        '쇼핑': 'MT1',
        '숙박': 'AD5',
        '병원': 'HP8',
        '약국': 'PM9'
      };
      
      // 활동에 따른 카테고리 추천
      if (activity.includes('카페') || activity.includes('커피')) return 'CE7';
      if (activity.includes('영화') || activity.includes('문화')) return 'CT1';
      if (activity.includes('쇼핑') || activity.includes('구경')) return 'MT1';
      if (activity.includes('관광') || activity.includes('명소')) return 'AT4';
      
      return 'FD6'; // 기본값: 음식점
    }

    // 실제 장소 검색 함수
    async function searchRealPlaces(location, keyword, category = 'FD6') {
      const searchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(keyword + ' ' + location)}&category_group_code=${category}&size=3&sort=accuracy`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
      });

      if (!response.ok) {
        console.error('Kakao API 호출 실패');
        return [];
      }

      const data = await response.json();
      return data.documents.map(place => ({
        name: place.place_name,
        category: place.category_name,
        address: place.road_address_name || place.address_name,
        phone: place.phone,
        url: place.place_url
      }));
    }
    
    // 프롬프트 생성
    // 1단계: AI로 데이트 코스 구조 생성
    const structurePrompt = `
    다음 조건을 바탕으로 하루 데이트 코스의 구조와 컨셉을 추천해주세요:

    **조건:**
    - 거주지역: ${formData.currentLocation}
    - 데이트지역: ${formData.dateLocation}
    - 자차유무: ${formData.hasCar === 'yes' ? '있음' : '없음'}
    - 선호음식: ${formData.preferredFood || '제한없음'}
    - 선호활동: ${formData.activities || '제한없음'}
    - 예산: ${getBudgetText(formData.budget)}

    **요구사항:**
    1. 시간순으로 4-5개의 코스 구조 추천 (오전~저녁)
    2. 각 코스별로 활동 유형, 검색 키워드, 예상비용만 포함
    3. 구체적인 가게명은 언급하지 말고 "브런치 카페", "이탈리안 레스토랑" 등으로 표현
    4. 총 예상 비용과 소요시간 계산

    다음 JSON 형식으로 답변해주세요:
    {
        "totalCost": "총 예상비용 (예: 80,000원)",
        "totalTime": "총 소요시간 (예: 8시간)",
        "concept": "데이트 코스 컨셉 (한 줄)",
        "courses": [
            {
                "time": "시간 (예: 10:00-12:00)",
                "activity": "활동 유형 (예: 브런치)",
                "searchKeyword": "검색용 키워드 (예: 브런치 카페)",
                "category": "카테고리 (카페/음식점/관광명소/문화시설/쇼핑 중 하나)",
                "description": "활동 설명 (1-2줄)",
                "cost": "예상비용 (예: 15,000원)"
            }
        ]
    }
    `;

    // AI로 구조 생성
    const structureResponse = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: structurePrompt
          }]
        }]
      })
    });

    if (!structureResponse.ok) {
      throw new Error(`구조 생성 API 호출 실패: ${structureResponse.status}`);
    }

    const structureData = await structureResponse.json();
    const structureText = structureData.candidates[0].content.parts[0].text;
    
    const structureJsonMatch = structureText.match(/\{[\s\S]*\}/);
    if (!structureJsonMatch) {
      throw new Error('구조 응답 파싱 실패');
    }
    
    const courseStructure = JSON.parse(structureJsonMatch[0]);

    // 2단계: 각 코스별로 실제 장소 검색
    const finalCourses = [];
    
    for (const course of courseStructure.courses) {
      const categoryCode = getCategoryCode(course.category);
      const realPlaces = await searchRealPlaces(
        formData.dateLocation, 
        course.searchKeyword, 
        categoryCode
      );
      
      let selectedPlace;
      let selectionReason = '';
      
      if (realPlaces.length > 0) {
        // 첫 번째 장소 선택 (정확도 순으로 정렬됨)
        selectedPlace = realPlaces[0];
        
        // 선정 이유 생성
        const reasons = [];
        if (selectedPlace.category.includes('맛집')) reasons.push('평점이 높은 인기 맛집');
        if (selectedPlace.address.includes('역')) reasons.push('접근성이 좋은 위치');
        if (course.category === '카페') reasons.push('분위기 좋은 카페');
        if (course.category === '문화시설') reasons.push('데이트 분위기에 적합');
        
        selectionReason = reasons.length > 0 ? reasons[0] : '해당 지역의 대표적인 장소';
      }
      
      finalCourses.push({
        time: course.time,
        title: course.activity,
        location: selectedPlace ? selectedPlace.name : course.searchKeyword,
        address: selectedPlace ? selectedPlace.address : formData.dateLocation,
        phone: selectedPlace ? selectedPlace.phone : '',
        url: selectedPlace ? selectedPlace.url : '',
        description: course.description,
        selectionReason: selectionReason,
        cost: course.cost,
        realPlace: !!selectedPlace
      });
    }

    const result = {
      totalCost: courseStructure.totalCost,
      totalTime: courseStructure.totalTime,
      concept: courseStructure.concept,
      courses: finalCourses
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: '데이트 코스 생성 중 오류가 발생했습니다.',
      error: error.message 
    });
  }
}
