// js/location-search-handler.js - 위치 검색 및 하단바 처리
class LocationSearchHandler {
    constructor() {
        this.searchResults = [];
        this.markers = [];
        this.selectedLocation = null;
    }

    // 사용자 입력 처리
async processUserInput(message) {
    console.log('🔍 사용자 입력 처리 시작:', message);
    
    try {
        // AI 기반 자연어 처리로 장소 검색
        console.log('🤖 AI 검색 시도 중...');
        const aiResult = await this.searchWithAI(message);
        console.log('🤖 AI 검색 결과:', aiResult);
        
        if (aiResult.success && aiResult.places.length > 0) {
            console.log('✅ AI 검색 성공, 결과 표시');
            this.searchResults = aiResult.places;
            
            // 하단바에 결과 표시
            this.displayBottomBar();
            
            // 지도에 마커 표시
            this.displayMarkersOnMap();
            
            // AI 응답 메시지 반환
            return aiResult.aiResponse;
        } else {
            console.log('⚠️ AI 검색 결과 없음, 폴백 검색으로 전환');
            // AI 검색 실패 시 기존 방식으로 폴백
            return await this.fallbackSearch(message);
        }
        
    } catch (error) {
        console.error('❌ AI 장소 검색 오류:', error);
        // 오류 시 기존 방식으로 폴백
        return await this.fallbackSearch(message);
    }
}

    // 백엔드 API로 장소 검색
async searchPlaces(keyword) {
    // 지역명인지 판단
    const regionKeywords = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '홍대', '강남', '명동', '이태원', '신촌', '건대', '압구정', '가로수길'];
    const isRegion = regionKeywords.some(region => keyword.includes(region));
    
    if (isRegion) {
        // 지역명이면 혼합 검색 (지역 정보 + 실제 장소)
        const [regionData, placeData] = await Promise.all([
            this.searchRegionInfo(keyword),
            this.searchActualPlaces(keyword)
        ]);
        
        // 첫 번째는 지역 정보, 나머지는 실제 장소
        return [regionData, ...placeData.slice(0, 2)].filter(Boolean);
    } else {
        // 구체적인 장소명이면 일반 검색
        return await this.searchActualPlaces(keyword);
    }
}

// 지역 정보 검색
async searchRegionInfo(keyword) {
    const response = await fetch('/api/search-kakao-places', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            location: '',
            keyword: keyword,
            category: null,
            size: 1,
            isRegion: true
        })
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.places.length === 0) return null;
    
    const place = data.places[0];
    return {
        name: `${keyword} 지역`,
        category: '지역',
        address: place.address,
        phone: '',
        url: place.url,
        coordinates: {
            lat: place.y,
            lng: place.x
        }
    };
}

// AI 기반 장소 검색
async searchWithAI(message) {
    const response = await fetch('/api/ai-place-search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userMessage: message
        })
    });

    if (!response.ok) {
        throw new Error(`AI 검색 API 호출 실패: ${response.status}`);
    }

    return await response.json();
}

// 기존 방식 폴백 검색
async fallbackSearch(message) {
    console.log('🔄 폴백 검색 시작:', message);
    
    // 키워드 단순화 시도
    const simplifiedKeywords = this.extractSearchKeywords(message);
    console.log('🔍 추출된 키워드:', simplifiedKeywords);
    
    let allPlaces = [];
    
    // 여러 키워드로 검색 시도
    for (const keyword of simplifiedKeywords) {
        try {
            console.log(`🔍 키워드 "${keyword}"로 검색 중...`);
            const places = await this.searchActualPlaces(keyword);
            console.log(`📍 "${keyword}" 검색 결과: ${places.length}개`);
            
            if (places.length > 0) {
                allPlaces.push(...places);
            }
        } catch (error) {
            console.warn(`키워드 "${keyword}" 검색 실패:`, error);
        }
    }
    
    // 중복 제거
    const uniquePlaces = this.removeDuplicatePlaces(allPlaces);
    console.log('📊 중복 제거 후 총 결과:', uniquePlaces.length);
    
    if (uniquePlaces.length === 0) {
        return `'${message}'에 대한 검색 결과가 없습니다. 더 간단한 키워드로 검색해보세요.\n\n예: "대구 공원", "대구 카페", "피크닉"`;
    }

    this.searchResults = uniquePlaces.slice(0, 3);
    this.displayBottomBar();
    this.displayMarkersOnMap();
    
    return this.generateResponseMessage(message, this.searchResults);
}
// 실제 장소 검색
async searchActualPlaces(keyword) {
    const response = await fetch('/api/search-kakao-places', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            location: '',
            keyword: keyword,
            category: null,
            size: 15
        })
    });

    if (!response.ok) {
        throw new Error(`장소 검색 API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    
    return data.places.map(place => ({
        name: place.name,
        category: place.category,
        address: place.address,
        phone: place.phone,
        url: place.url,
        coordinates: {
            lat: place.y,
            lng: place.x
        }
    }));
}

    

    // 하단바에 검색 결과 표시
async displayBottomBar() {
    let bottomBar = document.getElementById('bottomBar');
    
    if (!bottomBar) {
        // 하단바 생성
        bottomBar = document.createElement('div');
        bottomBar.id = 'bottomBar';
        bottomBar.className = 'bottom-bar';
        document.body.appendChild(bottomBar);
    }

    const labels = ['A', 'B', 'C'];
    const colors = ['#FF4444', '#4444FF', '#44AA44'];
    
    // 각 장소의 이미지 URL 가져오기
    const placeImages = await Promise.all(
        this.searchResults.map(place => this.getPlaceImage(place.name))
    );
    
    bottomBar.innerHTML = `
        <div class="bottom-bar-content">
            <div class="bottom-bar-title">아래 장소를 클릭하면 카카오맵으로 넘어갑니다</div>
            <div class="location-options">
                ${this.searchResults.map((place, index) => `
                    <div class="location-option" onclick="window.open('${place.url}', '_blank')" data-index="${index}">
                        <div class="location-image-container">
                            <img src="${placeImages[index]}" alt="${place.name}" class="location-image" />
                            <div class="location-label" style="background-color: ${colors[index]}">${labels[index]}</div>
                        </div>
                        <div class="location-info">
                            <div class="location-name">${place.name}</div>
                            <div class="location-address">${place.address}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    bottomBar.classList.add('show');
    
    // 채팅창에 선택 버튼 추가
    this.addSelectionButtons();
}

// 채팅창에 A,B,C 선택 버튼 추가
addSelectionButtons() {
    const labels = ['A', 'B', 'C'];
    const colors = ['#FF4444', '#4444FF', '#44AA44'];
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'selection-buttons';
    buttonContainer.innerHTML = `
        <div class="selection-message">원하는 장소를 선택해주세요:</div>
        <div class="button-row">
            ${this.searchResults.map((place, index) => `
                <button class="selection-btn" 
                        style="background-color: ${colors[index]}" 
                        onclick="locationSearchHandler.selectLocation(${index})">
                    ${labels[index]}
                </button>
            `).join('')}
        </div>
    `;
    
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message selection-message-container';
    messageDiv.appendChild(buttonContainer);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

    // 장소 이미지 가져오기
    
async getPlaceImage(placeName) {
    // 플레이스 홀더 이미지 배열
    const placeholderImages = [
        'https://via.placeholder.com/120x90/667eea/ffffff?text=Place+1',
        'https://via.placeholder.com/120x90/764ba2/ffffff?text=Place+2', 
        'https://via.placeholder.com/120x90/f093fb/ffffff?text=Place+3'
    ];
    
    // 장소명 해시값을 기반으로 이미지 선택
    const hash = placeName.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    
    return placeholderImages[Math.abs(hash) % placeholderImages.length];
}

    // 지도에 마커 표시
displayMarkersOnMap() {
    if (!searchMapInstance || !searchMapInstance.map) {
        console.warn('지도가 초기화되지 않았습니다.');
        return;
    }

    // 기존 마커 제거
    this.clearMarkers();

    const labels = ['A', 'B', 'C'];
    const colors = ['#FF4444', '#4444FF', '#44AA44'];
    const bounds = new kakao.maps.LatLngBounds();

    this.searchResults.forEach((place, index) => {
        const position = new kakao.maps.LatLng(place.coordinates.lat, place.coordinates.lng);
        
        // 커스텀 오버레이로 라벨 마커 생성
        const markerContent = document.createElement('div');
        markerContent.className = 'custom-marker';
        markerContent.style.cssText = `
            background-color: ${colors[index]};
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
        `;
        markerContent.textContent = labels[index];

        const customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: markerContent,
            yAnchor: 0.5
        });

        customOverlay.setMap(searchMapInstance.map);
        this.markers.push(customOverlay);

        // 마커 클릭 이벤트
        markerContent.addEventListener('click', () => {
            this.selectLocation(index);
        });

        // 바운드에 추가
        bounds.extend(position);
    });

    // 지도 범위 조정 (하단바를 고려한 패딩 적용)
    if (this.searchResults.length > 1) {
        // 하단바 높이 계산 (약 300px + 여유분)
        const bottomBarHeight = 350;
        const mapContainer = document.getElementById('searchMap');
        const mapHeight = mapContainer.offsetHeight;
        
        // 하단바를 제외한 가용 영역 계산
        const availableHeight = mapHeight - bottomBarHeight;
        const topPadding = 50;
        const bottomPadding = bottomBarHeight + 50;
        
        searchMapInstance.map.setBounds(bounds, topPadding, 80, bottomPadding, 80);
    } else {
        // 단일 마커인 경우 하단바를 피해서 위쪽에 중심 배치
        const singlePosition = new kakao.maps.LatLng(
            this.searchResults[0].coordinates.lat,
            this.searchResults[0].coordinates.lng
        );
        
        searchMapInstance.map.setCenter(singlePosition);
        searchMapInstance.map.setLevel(4);
        
        // 마커가 하단바에 가려지지 않도록 지도를 약간 위로 이동
        setTimeout(() => {
            const projection = searchMapInstance.map.getProjection();
            const point = projection.pointFromCoords(singlePosition);
            point.y -= 100; // 100px 위로 이동
            const newCenter = projection.coordsFromPoint(point);
            searchMapInstance.map.setCenter(newCenter);
        }, 100);
    }
}

    // 장소 선택
selectLocation(index) {
    const selectedPlace = this.searchResults[index];
    this.selectedLocation = selectedPlace;

    // 하단바 숨기기
    const bottomBar = document.getElementById('bottomBar');
    if (bottomBar) {
        bottomBar.classList.remove('show');
    }

    // 기존 A,B,C 마커들 모두 제거
    this.clearMarkers();

    // 세부 코스 제목 업데이트
    const detailCourseHeader = document.querySelector('.detail-course-header h3');
    if (detailCourseHeader) {
        detailCourseHeader.textContent = `1. ${selectedPlace.name}`;
    }

    // 우측 사이드바 활성화 및 장소 확인 인터페이스 표시
const rightSidebar = document.getElementById('rightSidebar');
const detailCourseBox = document.getElementById('detailCourseBox');
const detailCourseContent = document.getElementById('detailCourseContent');

if (rightSidebar && detailCourseBox && detailCourseContent) {
    rightSidebar.classList.add('active');
    detailCourseBox.classList.add('active');
    
    // 세부 코스 헤더 업데이트
    const detailCourseHeader = document.querySelector('.detail-course-header h3');
    if (detailCourseHeader) {
        detailCourseHeader.textContent = `1. ${selectedPlace.name} 확인`;
    }
    
    // 장소 확인 인터페이스 생성
    this.displayPlaceConfirmation(selectedPlace, detailCourseContent);
}

    // 대표 위치 마커 생성
    this.createRepresentativeMarker(selectedPlace);

    // 채팅에 선택 결과 추가
    const message = `'${selectedPlace.name}'을(를) 선택하셨습니다!\n📍 ${selectedPlace.address}\n\n이 장소 주변으로 데이트 코스를 계획해드릴까요? 원하시는 활동이나 분위기를 알려주세요!`;
    addMessage(message, 'ai');
}

// 대표 위치 마커 생성
createRepresentativeMarker(place) {
    if (!searchMapInstance || !searchMapInstance.map) return;

    const position = new kakao.maps.LatLng(place.coordinates.lat, place.coordinates.lng);
    
    // 대표 위치 아이콘 생성 (1번 마커)
    const markerContent = document.createElement('div');
    markerContent.className = 'representative-marker';
    markerContent.style.cssText = `
        background: linear-gradient(45deg, #667eea, #764ba2);
        color: white;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        position: relative;
    `;
    markerContent.textContent = '1';

    const customOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: markerContent,
        yAnchor: 0.5
    });

    customOverlay.setMap(searchMapInstance.map);
    this.markers.push(customOverlay);

    // 하단바를 고려한 정중앙 배치
    const mapContainer = document.getElementById('searchMap');
    const mapHeight = mapContainer.offsetHeight;
    const bottomBarHeight = 300; // 하단바 높이
    
    // 하단바를 제외한 가용 영역의 중앙 계산
    const availableHeight = mapHeight - bottomBarHeight;
    const offsetPixels = bottomBarHeight / 2; // 하단바 높이의 절반만큼 위로 이동
    
    // 1km 반경이 보이는 지도 레벨 (레벨 6이 약 1km 반경)
    searchMapInstance.map.setLevel(6);
    
    // 지도 중심을 하단바를 고려해서 조정
    setTimeout(() => {
        const projection = searchMapInstance.map.getProjection();
        const point = projection.pointFromCoords(position);
        point.y -= offsetPixels; // 하단바 높이 절반만큼 위로 이동
        const adjustedCenter = projection.coordsFromPoint(point);
        searchMapInstance.map.setCenter(adjustedCenter);
    }, 100);
}

    // 응답 메시지 생성
    generateResponseMessage(keyword, results) {
        if (results.length === 1) {
            return `'${keyword}'로 검색한 결과 1개의 장소를 찾았습니다:\n\n하단의 A를 클릭하거나 지도의 마커를 선택해주세요!`;
        } else {
            return `'${keyword}'로 검색한 결과 ${results.length}개의 장소를 찾았습니다:\n\n하단의 A, B, C 중에서 원하는 장소를 선택하거나 지도의 마커를 클릭해주세요!`;
        }
    }
// 검색 키워드 추출 함수 추가
    extractSearchKeywords(message) {
        const keywords = [];
        
        // 지역명 추출
        const regions = ['대구', '서울', '부산', '인천', '광주', '대전', '울산', '세종', '홍대', '강남', '명동', '이태원', '신촌', '건대', '압구정', '가로수길'];
        const foundRegion = regions.find(region => message.includes(region));
        
        // 활동/장소 키워드 추출
        const activityMap = {
            '피크닉': ['공원', '야외', '잔디'],
            '데이트': ['카페', '레스토랑', '영화관'],
            '맛집': ['레스토랑', '음식점', '맛집'],
            '카페': ['카페', '커피'],
            '쇼핑': ['쇼핑몰', '백화점', '상가'],
            '관광': ['관광지', '명소', '여행'],
            '문화': ['박물관', '미술관', '전시관'],
            '야경': ['야경', '전망대', '루프탑']
        };
        
        // 메시지에서 활동 키워드 찾기
        for (const [activity, places] of Object.entries(activityMap)) {
            if (message.includes(activity)) {
                if (foundRegion) {
                    places.forEach(place => keywords.push(`${foundRegion} ${place}`));
                } else {
                    keywords.push(...places);
                }
            }
        }
        
        // 키워드를 찾지 못했으면 지역명과 전체 메시지로 검색
        if (keywords.length === 0) {
            if (foundRegion) {
                keywords.push(foundRegion);
                keywords.push(foundRegion + ' 공원'); // 피크닉 관련 기본 검색
            } else {
                keywords.push(message);
            }
        }
        
        return [...new Set(keywords)]; // 중복 제거
    }

    // 중복 장소 제거 함수 추가
    removeDuplicatePlaces(places) {
        const uniquePlaces = [];
        const seenNames = new Set();
        
        places.forEach(place => {
            // 장소명으로 중복 체크 (대소문자 무시)
            const normalizedName = place.name.toLowerCase().trim();
            if (!seenNames.has(normalizedName)) {
                seenNames.add(normalizedName);
                uniquePlaces.push(place);
            }
        });
        
        return uniquePlaces;
    }
    // 마커 제거
    clearMarkers() {
        this.markers.forEach(marker => {
            if (marker && typeof marker.setMap === 'function') {
                marker.setMap(null);
            }
        });
        this.markers = [];
    }

    // 장소 확인 인터페이스 표시
async displayPlaceConfirmation(place, container) {
    const placeImage = await this.getPlaceImage(place.name);
    
    container.innerHTML = `
        <div class="place-confirmation">
            <div class="confirmation-question" id="confirmationQuestion">
                이 위치를 실제로 방문하실건가요?
            </div>
            
            <div class="selected-location-block" id="selectedLocationBlock" onclick="window.open('${place.url}', '_blank')" style="cursor: pointer;">
                <div class="location-image-container">
                    <img src="${placeImage}" alt="${place.name}" class="location-image" />
                </div>
                <div class="location-info">
                    <div class="location-name">${place.name}</div>
                    <div class="location-address">${place.address}</div>
                </div>
            </div>
            
            <div class="confirmation-buttons" id="confirmationButtons">
                <button class="confirm-btn check-btn" onclick="locationSearchHandler.confirmPlace(true)">
    ✓
</button>
<button class="confirm-btn cancel-btn" onclick="locationSearchHandler.confirmPlace(false)">
    ✗
</button>
            </div>
        </div>
    `;
}

// 장소 확인 처리
confirmPlace(isConfirmed) {
    const confirmationQuestion = document.getElementById('confirmationQuestion');
    const confirmationButtons = document.getElementById('confirmationButtons');
    const selectedLocationBlock = document.getElementById('selectedLocationBlock');
    
    if (isConfirmed) {
        // 체크 버튼을 누른 경우 - 질문과 버튼만 제거
        if (confirmationQuestion) confirmationQuestion.remove();
        if (confirmationButtons) confirmationButtons.remove();
        
        // 채팅에 확인 메시지 추가
        const message = `장소 확인이 완료되었습니다! 이제 이 위치를 기준으로 데이트 코스를 계획해드릴게요. 원하시는 활동이나 분위기를 알려주세요!`;
        addMessage(message, 'ai');
    } else {
        // 엑스 버튼을 누른 경우 - 모든 요소 제거
        if (confirmationQuestion) confirmationQuestion.remove();
        if (confirmationButtons) confirmationButtons.remove();
        if (selectedLocationBlock) selectedLocationBlock.remove();
        
        // 기본 메시지로 복원
        const detailCourseContent = document.getElementById('detailCourseContent');
        if (detailCourseContent) {
            detailCourseContent.innerHTML = `
                <div class="no-course-message">
                    다른 위치를 선택해주세요.<br>
                    AI 채팅에서 새로운 장소를 검색해보세요!
                </div>
            `;
        }
        
        // 채팅에 취소 메시지 추가
        const message = `장소 선택이 취소되었습니다. 다른 위치를 검색해주세요!`;
        addMessage(message, 'ai');
        
        // 대표 마커도 제거
        this.clearMarkers();
    }
}

    // 초기화 메시지
    getInitialMessage() {
        return "안녕하세요! 어디로 놀러 가고 싶으신가요? 🎯\n\n지역이나 특정 위치를 말해주세요!\n(예: 야외음악당, 홍대, 강남역, 부산 해운대 등)";
    }
}

// 전역 인스턴스
const locationSearchHandler = new LocationSearchHandler();
