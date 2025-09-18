// api/search-kakao-places.js
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

  const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_API_KEY) {
    return res.status(500).json({ message: 'Kakao API 키가 설정되지 않았습니다.' });
  }

  try {
    const { location, category, keyword, size = 5, isRegion = false } = req.body;

console.log('📝 요청 데이터:', {
    location,
    category,
    keyword,
    size,
    isRegion,
    apiKeyLength: KAKAO_API_KEY ? KAKAO_API_KEY.length : 0
});

// 카카오 로컬 API 검색 - 전국 제거
const searchQuery = location ? `${keyword} ${location}` : keyword;
let searchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}&size=${size}&sort=accuracy`;

// 카테고리가 있을 때만 추가 (빈 문자열일 때 400 오류 발생 가능)
if (category && category.trim() !== '') {
    searchUrl += `&category_group_code=${category}`;
}

console.log('🔍 요청 URL:', searchUrl);
    
    const response = await fetch(searchUrl, {
  headers: {
    'Authorization': `KakaoAK ${KAKAO_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

if (!response.ok) {
  const errorText = await response.text();
  console.error('❌ 카카오 API 응답:', {
    status: response.status,
    statusText: response.statusText,
    error: errorText
  });
  throw new Error(`Kakao API 호출 실패: ${response.status} - ${errorText}`);
}

    const data = await response.json();
    
    // 결과 가공
    const places = data.documents.map(place => ({
      name: place.place_name,
      category: place.category_name,
      address: place.road_address_name || place.address_name,
      phone: place.phone,
      url: place.place_url,
      x: place.x, // 경도
      y: place.y, // 위도
      distance: place.distance,
      id: place.id
    }));

    res.status(200).json({
      places: places,
      total: data.meta.total_count,
      hasMore: !data.meta.is_end
    });

  } catch (error) {
    console.error('Kakao Places API Error:', error);
    res.status(500).json({ 
      message: '장소 검색 중 오류가 발생했습니다.',
      error: error.message 
    });
  }
}
