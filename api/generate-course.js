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
  if (!API_KEY) {
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
    
    // 프롬프트 생성
    const prompt = `
    다음 조건을 바탕으로 하루 데이트 코스를 상세히 추천해주세요:

    **조건:**
    - 거주지역: ${formData.currentLocation}
    - 데이트지역: ${formData.dateLocation}
    - 자차유무: ${formData.hasCar === 'yes' ? '있음' : '없음'}
    - 선호음식: ${formData.preferredFood || '제한없음'}
    - 선호활동: ${formData.activities || '제한없음'}
    - 예산: ${getBudgetText(formData.budget)}

    **요구사항:**
    1. 시간순으로 4-6개의 코스 추천 (오전~저녁)
    2. 각 코스별로 예상 소요시간, 예상비용 포함
    3. 실제 존재하는 장소명 또는 지역명 사용
    4. 총 예상 비용과 소요시간 계산
    5. JSON 형식으로 응답

    다음 JSON 형식으로 답변해주세요:
    {
        "totalCost": "총 예상비용 (예: 80,000원)",
        "totalTime": "총 소요시간 (예: 8시간)",
        "courses": [
            {
                "time": "시간 (예: 10:00-12:00)",
                "title": "코스 제목",
                "location": "구체적인 장소명",
                "description": "코스 설명 (2-3줄)",
                "cost": "예상비용 (예: 15,000원)"
            }
        ]
    }
    `;

    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    // JSON 파싱
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      res.status(200).json(result);
    } else {
      console.error('Response parsing failed:', responseText);
      throw new Error('응답 파싱 실패');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: '데이트 코스 생성 중 오류가 발생했습니다.',
      error: error.message 
    });
  }
}
