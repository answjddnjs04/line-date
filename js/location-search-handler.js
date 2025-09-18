// js/location-search-handler.js - 위치 검색 및 하단바 처리
class LocationSearchHandler {
    constructor() {
        this.searchResults = [];
        this.markers = [];
        this.selectedLocation = null;
    }

    // 사용자 입력 처리
    async processUserInput(message) {
        try {
            // 카카오 API로 장소 검색
            const places = await this.searchPlaces(message);
            
            if (places.length === 0) {
                return `'${message}'에 대한 검색 결과가 없습니다. 다른 장소명을 입력해주세요.`;
            }

            // 최대 3개까지만 표시
            this.searchResults = places.slice(0, 3);
            
            // 하단바에 결과 표시
            this.displayBottomBar();
            
            // 지도에 마커 표시
            this.displayMarkersOnMap();
            
            // 응답 메시지 생성
            return this.generateResponseMessage(message, this.searchResults);
            
        } catch (error) {
            console.error('장소 검색 오류:', error);
            return '장소 검색 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
    }

    // 백엔드 API로 장소 검색
async searchPlaces(keyword) {
    const response = await fetch('/api/search-kakao-places', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
    location: '전국',
    keyword: keyword,
    category: null, // 빈 문자열 대신 null 사용
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
    displayBottomBar() {
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
        
        bottomBar.innerHTML = `
            <div class="bottom-bar-content">
                <div class="bottom-bar-title">검색된 장소를 선택하세요:</div>
                <div class="location-options">
                    ${this.searchResults.map((place, index) => `
                        <div class="location-option" onclick="locationSearchHandler.selectLocation(${index})" data-index="${index}">
                            <div class="location-label" style="background-color: ${colors[index]}">${labels[index]}</div>
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

        // 지도 범위 조정
        if (this.searchResults.length > 1) {
            searchMapInstance.map.setBounds(bounds, 80);
        } else {
            searchMapInstance.map.setCenter(new kakao.maps.LatLng(
                this.searchResults[0].coordinates.lat,
                this.searchResults[0].coordinates.lng
            ));
            searchMapInstance.map.setLevel(3);
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

        // 선택된 장소로 지도 이동
        if (searchMapInstance && searchMapInstance.map) {
            const position = new kakao.maps.LatLng(
                selectedPlace.coordinates.lat,
                selectedPlace.coordinates.lng
            );
            searchMapInstance.map.setCenter(position);
            searchMapInstance.map.setLevel(2);
        }

        // 채팅에 선택 결과 추가
        const message = `'${selectedPlace.name}'을(를) 선택하셨습니다!\n📍 ${selectedPlace.address}\n\n이 장소 주변으로 데이트 코스를 계획해드릴까요? 원하시는 활동이나 분위기를 알려주세요!`;
        addMessage(message, 'ai');
    }

    // 응답 메시지 생성
    generateResponseMessage(keyword, results) {
        if (results.length === 1) {
            return `'${keyword}'로 검색한 결과 1개의 장소를 찾았습니다:\n\n하단의 A를 클릭하거나 지도의 마커를 선택해주세요!`;
        } else {
            return `'${keyword}'로 검색한 결과 ${results.length}개의 장소를 찾았습니다:\n\n하단의 A, B, C 중에서 원하는 장소를 선택하거나 지도의 마커를 클릭해주세요!`;
        }
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

    // 초기화 메시지
    getInitialMessage() {
        return "안녕하세요! 어디로 놀러 가고 싶으신가요? 🎯\n\n지역이나 특정 위치를 말해주세요!\n(예: 야외음악당, 홍대, 강남역, 부산 해운대 등)";
    }
}

// 전역 인스턴스
const locationSearchHandler = new LocationSearchHandler();
