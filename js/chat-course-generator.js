// js/chat-course-generator.js - 채팅 기반 데이트 코스 생성
class ChatCourseGenerator {
    constructor() {
        this.currentStep = 'location';
        this.formData = {
            currentLocation: '',
            dateLocation: '',
            hasCar: 'no',
            preferredFood: '',
            activities: '',
            budget: ''
        };
        this.isGenerating = false;
    }

    // 사용자 입력 처리
    async processUserInput(message) {
        if (this.isGenerating) {
            return "잠시만요! 현재 데이트 코스를 생성 중입니다...";
        }

        switch (this.currentStep) {
            case 'location':
                return this.handleLocationInput(message);
            case 'car':
                return this.handleCarInput(message);
            case 'food':
                return this.handleFoodInput(message);
            case 'activities':
                return this.handleActivitiesInput(message);
            case 'budget':
                return this.handleBudgetInput(message);
            case 'generate':
                return await this.generateCourse();
            default:
                return this.resetConversation();
        }
    }

    handleLocationInput(message) {
        this.formData.dateLocation = message;
        this.currentStep = 'car';
        return `${message}에서의 데이트 코스를 계획해드릴게요! 🚗 자차가 있으신가요? (있음/없음)`;
    }

    handleCarInput(message) {
        const input = message.toLowerCase();
        if (input.includes('있') || input.includes('yes') || input === '있음') {
            this.formData.hasCar = 'yes';
        } else if (input.includes('없') || input.includes('no') || input === '없음') {
            this.formData.hasCar = 'no';
        } else {
            return "자차 유무를 '있음' 또는 '없음'으로 답해주세요!";
        }
        
        this.currentStep = 'food';
        return `${this.formData.hasCar === 'yes' ? '자차가 있으시니 더 많은 선택지가 있겠네요!' : '대중교통을 이용한 코스로 계획해드릴게요!'} 🍽️ 선호하는 음식이 있나요? (예: 한식, 이탈리안, 일식 등 - 없으면 '없음')`;
    }

    handleFoodInput(message) {
        if (message.toLowerCase() !== '없음' && message.toLowerCase() !== 'no') {
            this.formData.preferredFood = message;
        }
        this.currentStep = 'activities';
        return `${this.formData.preferredFood ? `${this.formData.preferredFood} 맛집들을 포함해서 계획해드릴게요!` : '다양한 맛집들을 추천해드릴게요!'} 🎯 선호하는 활동이 있나요? (예: 영화, 쇼핑, 카페, 박물관 등 - 없으면 '없음')`;
    }

    handleActivitiesInput(message) {
        if (message.toLowerCase() !== '없음' && message.toLowerCase() !== 'no') {
            this.formData.activities = message;
        }
        this.currentStep = 'budget';
        return `${this.formData.activities ? `${this.formData.activities} 활동을 포함한 코스로 준비하겠습니다!` : '다양한 활동들을 추천해드릴게요!'} 💰 예산 범위가 있나요?\n\n1️⃣ 5만원 이하\n2️⃣ 5-10만원\n3️⃣ 10만원 이상\n4️⃣ 제한 없음\n\n번호나 직접 입력해주세요!`;
    }

    handleBudgetInput(message) {
        const input = message.toLowerCase();
        if (input.includes('1') || input.includes('5만원 이하')) {
            this.formData.budget = 'low';
        } else if (input.includes('2') || input.includes('5-10만원')) {
            this.formData.budget = 'medium';
        } else if (input.includes('3') || input.includes('10만원 이상')) {
            this.formData.budget = 'high';
        } else {
            this.formData.budget = '';
        }

        this.currentStep = 'generate';
        return `모든 정보를 받았습니다! ✨\n\n📍 데이트 지역: ${this.formData.dateLocation}\n🚗 자차: ${this.formData.hasCar === 'yes' ? '있음' : '없음'}\n🍽️ 선호 음식: ${this.formData.preferredFood || '제한없음'}\n🎯 선호 활동: ${this.formData.activities || '제한없음'}\n💰 예산: ${this.getBudgetText(this.formData.budget)}\n\n완벽한 데이트 코스를 생성하겠습니다! '생성' 또는 '시작'을 입력해주세요.`;
    }

    async generateCourse() {
        if (this.isGenerating) {
            return "이미 코스를 생성 중입니다...";
        }

        this.isGenerating = true;
        
        try {
            // 거주지역 기본값 설정 (데이트 지역과 동일하게)
            this.formData.currentLocation = this.formData.dateLocation;

            const response = await fetch('/api/generate-course', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ formData: this.formData })
            });

            if (!response.ok) {
                throw new Error(`API 호출 실패: ${response.status}`);
            }

            const courseData = await response.json();
            
            // 세부 코스를 UI에 표시
            this.displayDetailedCourse(courseData);
            
            // 대화 리셋
            this.resetConversation();
            
            return `🎉 완벽한 데이트 코스가 완성되었습니다!\n\n📋 ${courseData.concept}\n💰 총 예상비용: ${courseData.totalCost}\n⏰ 총 소요시간: ${courseData.totalTime}\n\n세부 코스는 오른쪽 패널에서 확인하세요! 새로운 코스를 원하시면 다시 지역을 입력해주세요.`;

        } catch (error) {
            console.error('코스 생성 오류:', error);
            this.isGenerating = false;
            return `죄송합니다. 코스 생성 중 오류가 발생했습니다: ${error.message}\n\n다시 시도하시려면 '생성'을 입력해주세요.`;
        }
    }

    displayDetailedCourse(courseData) {
        const detailCourseContent = document.getElementById('detailCourseContent');
        const rightSidebar = document.getElementById('rightSidebar');
        const detailCourseBox = document.getElementById('detailCourseBox');

        if (!detailCourseContent) return;

        const html = `
            <div class="course-summary">
                <h4 style="color: #667eea; margin-bottom: 15px;">${courseData.concept}</h4>
                <div style="background: #f8f9ff; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <div style="margin-bottom: 8px;"><strong>💰 총 예상비용:</strong> ${courseData.totalCost}</div>
                    <div><strong>⏰ 총 소요시간:</strong> ${courseData.totalTime}</div>
                </div>
            </div>

            <div class="detailed-courses">
                ${courseData.courses.map((course, index) => `
                    <div class="detailed-course-item" style="
                        background: white; 
                        border: 2px solid #e8ecf4; 
                        border-radius: 15px; 
                        padding: 20px; 
                        margin-bottom: 20px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    ">
                        <div style="
                            background: #667eea; 
                            color: white; 
                            padding: 5px 12px; 
                            border-radius: 20px; 
                            font-size: 0.9rem; 
                            font-weight: 600; 
                            display: inline-block; 
                            margin-bottom: 15px;
                        ">${course.time}</div>

                        <div style="
                            font-size: 1.2rem; 
                            font-weight: bold; 
                            color: #2c3e50; 
                            margin-bottom: 10px;
                        ">
                            <span style="color: #667eea; margin-right: 8px;">${index + 1}.</span>
                            ${course.title}
                            ${course.realPlace ? '<span style="background: #27ae60; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 8px;">실제 장소</span>' : ''}
                        </div>

                        <div style="color: #6c7b8a; margin-bottom: 10px; font-weight: 500;">
                            📍 ${course.location}
                        </div>

                        ${course.address ? `<div style="color: #6c7b8a; font-size: 0.9rem; margin: 5px 0;">🏠 ${course.address}</div>` : ''}
                        ${course.phone ? `<div style="color: #6c7b8a; font-size: 0.9rem; margin: 5px 0;">📞 ${course.phone}</div>` : ''}

                        <div style="color: #34495e; line-height: 1.6; margin-bottom: 15px;">
                            ${course.description}
                        </div>

                        ${course.selectionReason ? `
                            <div style="
                                background: #fff3cd; 
                                color: #856404; 
                                padding: 8px 12px; 
                                border-radius: 8px; 
                                font-size: 0.9rem; 
                                margin: 10px 0; 
                                border-left: 3px solid #ffc107;
                            ">💡 ${course.selectionReason}</div>
                        ` : ''}

                        <div style="
                            display: flex; 
                            justify-content: space-between; 
                            align-items: center; 
                            margin-top: 15px;
                        ">
                            <div style="
                                background: #e8f5e8; 
                                color: #27ae60; 
                                padding: 8px 15px; 
                                border-radius: 10px; 
                                font-weight: bold;
                            ">${course.cost}</div>
                            
                            ${course.url ? `
                                <a href="${course.url}" target="_blank" style="
                                    background: #fee500; 
                                    color: #000; 
                                    padding: 8px 16px; 
                                    border-radius: 8px; 
                                    text-decoration: none; 
                                    font-weight: 600; 
                                    font-size: 0.9rem;
                                ">카카오맵에서 보기</a>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        detailCourseContent.innerHTML = html;

        // 오른쪽 사이드바와 버튼 활성화
        rightSidebar.classList.add('active');
        detailCourseBox.classList.add('active');
        
        // 토글 버튼 텍스트 업데이트
        const rightToggleBtn = document.querySelector('.right-toggle-btn');
        if (rightToggleBtn) {
            rightToggleBtn.textContent = '<';
        }
    }

    getBudgetText(budget) {
        switch(budget) {
            case 'low': return '5만원 이하';
            case 'medium': return '5-10만원';
            case 'high': return '10만원 이상';
            default: return '제한없음';
        }
    }

    resetConversation() {
        this.currentStep = 'location';
        this.formData = {
            currentLocation: '',
            dateLocation: '',
            hasCar: 'no',
            preferredFood: '',
            activities: '',
            budget: ''
        };
        this.isGenerating = false;
    }

    getInitialMessage() {
        return "안녕하세요! 완벽한 데이트 코스를 만들어드릴게요! 💕\n\n먼저 데이트 희망 지역을 알려주세요.\n(예: 홍대, 강남, 명동, 부산 해운대 등)";
    }
}

// 전역 인스턴스
const chatCourseGenerator = new ChatCourseGenerator();
