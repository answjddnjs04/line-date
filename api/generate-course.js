// api/generate-course.js
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://line-date.vercel.app');
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

// 디버그: API 키 확인
console.log('🔐 API 키 상태:', {
  gemini: API_KEY ? 'OK' : 'MISSING',
  kakao: KAKAO_API_KEY ? 'OK' : 'MISSING',
  kakaoLength: KAKAO_API_KEY ? KAKAO_API_KEY.length : 0
});

if (!API_KEY || !KAKAO_API_KEY) {
  console.error('❌ API 키 누락:', { gemini: !!API_KEY, kakao: !!KAKAO_API_KEY });
  return res.status(500).json({ 
    message: 'API 키가 설정되지 않았습니다.',
    debug: { gemini: !!API_KEY, kakao: !!KAKAO_API_KEY }
  });
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
    
    // 검색 키워드 단순화 함수 (searchRealPlaces 함수 위에 추가)
function simplifyKeyword(keyword) {
  const keywordMap = {
    '고급 브런치 카페': '브런치',
    '브런치 카페': '브런치',
    '미슐랭 레스토랑': '레스토랑',
    '고급 이탈리안 레스토랑': '이탈리안',
    '분위기 좋은 카페': '카페',
    '명품거리 쇼핑': '쇼핑',
    '야경 명소': '야경',
    '미술관 전시': '미술관'
  };
  
  // 매핑된 단순 키워드가 있으면 사용, 없으면 첫 번째 단어만 사용
  return keywordMap[keyword] || keyword.split(' ')[0];
}

// 거리 계산 함수 추가
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function searchRealPlaces(location, keyword, category = 'FD6', targetCoords = null, isFirstPlace = false) {
  // 키워드를 단순화
  const simpleKeyword = simplifyKeyword(keyword);
  const searchQuery = `${location} ${simpleKeyword}`;
  
  console.log(`🔍 검색 중: "${searchQuery}" (원본: "${keyword}") - ${isFirstPlace ? '첫 번째 장소' : '후속 장소'}`);
      const searchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}&category_group_code=${category}&size=15&sort=accuracy`;
      
      const response = await fetch(searchUrl, {
  headers: {
    'Authorization': `KakaoAK ${KAKAO_API_KEY}`
  }
});

console.log(`🌐 카카오 API 응답 상태:`, response.status);

if (!response.ok) {
  const errorText = await response.text();
  console.error('❌ Kakao API 호출 실패:', {
    status: response.status,
    statusText: response.statusText,
    error: errorText
  });
  return [];
}

const data = await response.json();
console.log(`📊 검색 결과:`, {
  totalCount: data.meta?.total_count || 0,
  resultCount: data.documents?.length || 0,
  query: searchQuery
});
      
      if (!data.documents || data.documents.length === 0) {
        console.log(`⚠️ "${searchQuery}" 검색 결과 없음`);
        return [];
      }
      
      // 거리 기반 필터링 적용
      let filteredPlaces = data.documents;
      
      // 첫 번째 장소는 사용자 입력 위치만 고려, 이후는 이전 장소 기준으로 필터링
      if (!isFirstPlace && targetCoords) {
        const originalLength = filteredPlaces.length;
        filteredPlaces = filteredPlaces.filter(place => {
          if (!place.x || !place.y) return true;
          
          const placeLat = parseFloat(place.y);
          const placeLng = parseFloat(place.x);
          const distance = calculateDistance(targetCoords.lat, targetCoords.lng, placeLat, placeLng);
          return distance <= 30; // 30km 이내
        });
        
        console.log(`🎯 거리 필터링: ${originalLength} -> ${filteredPlaces.length}개 장소 (기준: ${targetCoords.lat}, ${targetCoords.lng})`);
      } else {
        console.log(`📍 첫 번째 장소 - 거리 필터링 생략`);
      }
      
      const places = filteredPlaces.slice(0, 3).map(place => ({
        name: place.place_name,
        category: place.category_name,
        address: place.road_address_name || place.address_name,
        phone: place.phone,
        url: place.place_url,
        coordinates: {
          lat: parseFloat(place.y),
          lng: parseFloat(place.x)
        }
      }));
      
      console.log(`✅ 찾은 장소들:`, places);
      return places;
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
    
    // 데이트 지역의 기준 좌표 추출
    let targetCoords = null;
    try {
      const geocodeUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(formData.dateLocation)}`;
      const geocodeResponse = await fetch(geocodeUrl, {
        headers: {
          'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
      });
      
      if (geocodeResponse.ok) {
        const geocodeData = await geocodeResponse.json();
        if (geocodeData.documents.length > 0) {
          targetCoords = {
            lat: parseFloat(geocodeData.documents[0].y),
            lng: parseFloat(geocodeData.documents[0].x)
          };
          console.log(`📍 기준 좌표 설정: ${formData.dateLocation}`, targetCoords);
        }
      }
    } catch (error) {
      console.warn('기준 좌표 추출 실패:', error);
    }
    
    // 중복 처리를 위한 변수
    const usedPlaceNames = [];
    let firstPlaceCoords = null; // 첫 번째 장소 좌표 저장
    
    for (let i = 0; i < courseStructure.courses.length; i++) {
      const course = courseStructure.courses[i];
      const categoryCode = getCategoryCode(course.category);
      
      // 첫 번째 장소는 거리 필터링 없이, 이후는 이전 장소 기준으로 필터링
      const filterCoords = i === 0 ? null : (firstPlaceCoords || targetCoords);
      const realPlaces = await searchRealPlaces(
        formData.dateLocation, 
        course.searchKeyword, 
        categoryCode,
        filterCoords,
        i === 0 // 첫 번째 장소인지 여부
      );
      
      let selectedPlace;
      let selectionReason = '';
      
      if (realPlaces.length > 0) {
        // 중복 처리 로직 적용
        const isNoDuplicate = ['음식점', '카페', '레스토랑', '식당', '브런치', '디저트'].some(type => 
          course.searchKeyword.toLowerCase().includes(type) || 
          course.category.toLowerCase().includes(type)
        );
        
        if (isNoDuplicate) {
          // 중복 금지 - 사용되지 않은 장소 찾기
          selectedPlace = realPlaces.find(place => !usedPlaceNames.includes(place.name));
          if (!selectedPlace && realPlaces.length > 0) {
            selectedPlace = realPlaces[0]; // 어쩔 수 없으면 첫 번째
          }
        } else {
          // 중복 허용 (관광지, 공원 등)
          selectedPlace = realPlaces[0];
        }
        
        if (selectedPlace) {
          usedPlaceNames.push(selectedPlace.name);
          
          // 첫 번째 장소의 좌표를 저장하여 이후 장소들의 기준점으로 사용
          if (i === 0 && selectedPlace.coordinates) {
            firstPlaceCoords = selectedPlace.coordinates;
            console.log(`📍 첫 번째 장소 기준 좌표 설정:`, firstPlaceCoords);
          }
          
          // 선정 이유 생성
          const reasons = [];
          if (selectedPlace.category.includes('맛집')) reasons.push('평점이 높은 인기 맛집');
          if (selectedPlace.address.includes('역')) reasons.push('접근성이 좋은 위치');
          if (course.category === '카페') reasons.push('분위기 좋은 카페');
          if (course.category === '문화시설') reasons.push('데이트 분위기에 적합');
          
          selectionReason = reasons.length > 0 ? reasons[0] : '해당 지역의 대표적인 장소';
        }
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
        realPlace: !!selectedPlace,
        coordinates: selectedPlace ? selectedPlace.coordinates : null,
        isDuplicate: selectedPlace && usedPlaceNames.filter(name => name === selectedPlace.name).length > 1
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
