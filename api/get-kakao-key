// api/get-kakao-key.js
export default function handler(req, res) {
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

  const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
  
  if (!KAKAO_API_KEY) {
    return res.status(500).json({ 
      message: 'Kakao API 키가 설정되지 않았습니다.',
      key: null 
    });
  }

  // JavaScript SDK용 키는 보통 REST API 키와 동일하거나 별도로 설정
  // 환경변수에서 JavaScript용 키를 먼저 찾고, 없으면 REST API 키 사용
  const KAKAO_JS_KEY = process.env.KAKAO_JS_API_KEY || KAKAO_API_KEY;

  res.status(200).json({
    key: KAKAO_JS_KEY,
    success: true
  });
}
