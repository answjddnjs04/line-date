// api/get-place-image.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
  if (!UNSPLASH_ACCESS_KEY) {
    return res.status(500).json({ message: 'Unsplash API 키가 설정되지 않았습니다.' });
  }

  try {
    const { placeName } = req.query;
    if (!placeName) {
      return res.status(400).json({ message: '장소명이 필요합니다.' });
    }

    // 장소명에서 키워드 추출 (카페, 레스토랑 등)
    const keywords = extractKeywords(placeName);
    const searchQuery = keywords.join(' ');

    const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`, {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Unsplash API 오류: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const image = data.results[0];
      res.status(200).json({
        imageUrl: image.urls.small,
        alt: image.alt_description || placeName,
        photographer: image.user.name,
        unsplashUrl: image.links.html
      });
    } else {
      // 기본 이미지 반환
      res.status(200).json({
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
        alt: '기본 장소 이미지',
        photographer: 'Unsplash',
        unsplashUrl: 'https://unsplash.com'
      });
    }

  } catch (error) {
    console.error('Place image API Error:', error);
    res.status(500).json({ 
      message: '이미지 검색 중 오류가 발생했습니다.',
      error: error.message 
    });
  }
}

function extractKeywords(placeName) {
  const keywords = [];
  
  // 장소 유형별 키워드 매핑
  if (placeName.includes('카페') || placeName.includes('커피')) {
    keywords.push('cafe', 'coffee');
  } else if (placeName.includes('레스토랑') || placeName.includes('맛집')) {
    keywords.push('restaurant', 'food');
  } else if (placeName.includes('공원')) {
    keywords.push('park', 'nature');
  } else if (placeName.includes('박물관')) {
    keywords.push('museum');
  } else if (placeName.includes('호텔')) {
    keywords.push('hotel');
  } else {
    // 기본값
    keywords.push('place', 'building');
  }
  
  return keywords;
}
