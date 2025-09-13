// api/generate-course.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

  try {
    const { formData } = req.body;
    
    const prompt = `
    다음 조건을 바탕으로 하루 데이트 코스를 상세히 추천해주세요:
    // ... 기존 프롬프트 내용
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

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      res.status(200).json(result);
    } else {
      throw new Error('응답 파싱 실패');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
}
