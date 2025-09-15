// js/search-map.js - 검색 지도 기능
class SearchMap {
    constructor() {
        this.map = null;
        this.markers = [];
        this.infowindows = [];
        this.ps = null;
    }

    async init() {
    return new Promise((resolve, reject) => {
        if (typeof kakao === 'undefined') {
            reject(new Error('카카오맵 API가 로드되지 않았습니다.'));
            return;
        }

        kakao.maps.load(() => {
            // DOM 요소 존재 확인
            const container = document.getElementById('searchMap');
            console.log('🔍 지도 컨테이너 확인:', container);
            
            if (!container) {
                console.error('❌ searchMap 엘리먼트를 찾을 수 없습니다');
                reject(new Error('지도 컨테이너를 찾을 수 없습니다.'));
                return;
            }

            // 컨테이너 크기 확인
            if (container.offsetWidth === 0 || container.offsetHeight === 0) {
                console.warn('⚠️ 지도 컨테이너 크기가 0입니다');
            }

            const options = {
                center: new kakao.maps.LatLng(37.5665, 126.9780),
                level: 7
            };

            try {
                this.map = new kakao.maps.Map(container, options);
                this.ps = new kakao.maps.services.Places();
                console.log('✅ 검색 지도 초기화 완료');
                
                // 지도 크기 재조정
                setTimeout(() => {
                    this.map.relayout();
                }, 200);
                
                resolve();
            } catch (error) {
                console.error('❌ 지도 생성 중 오류:', error);
                reject(new Error(`지도 생성 실패: ${error.message}`));
            }
        });
    });
}

    searchPlaces(keyword, category = '') {
        if (!this.ps) {
            console.error('Places 서비스가 초기화되지 않았습니다.');
            return;
        }

        // 기존 마커들 제거
        this.clearMarkers();

        // 로딩 표시
        this.showLoading();

        // 검색 옵션 설정
        const options = {
            location: new kakao.maps.LatLng(37.5665, 126.9780),
            radius: 20000, // 20km 반경
            sort: kakao.maps.services.SortBy.ACCURACY
        };

        // 카테고리가 있으면 추가
        if (category) {
            options.category_group_code = this.getCategoryCode(category);
        }

        // 장소 검색
        this.ps.keywordSearch(keyword, (data, status, pagination) => {
            this.hideLoading();

            if (status === kakao.maps.services.Status.OK) {
                this.displaySearchResults(data);
                this.displayMarkersOnMap(data);
                
                // 지도 범위 조정
                if (data.length > 0) {
                    this.setBoundsFromResults(data);
                }
            } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
                this.showNoResults();
            } else {
                this.showError('검색 중 오류가 발생했습니다.');
            }
        }, options);
    }

    getCategoryCode(category) {
        const categoryMap = {
            'cafe': 'CE7',
            'restaurant': 'FD6',
            'attraction': 'AT4',
            'culture': 'CT1',
            'shopping': 'MT1'
        };
        return categoryMap[category] || '';
    }

    displayMarkersOnMap(places) {
        places.forEach((place, index) => {
            const markerPosition = new kakao.maps.LatLng(place.y, place.x);
            
            // 마커 생성
            const marker = new kakao.maps.Marker({
                position: markerPosition,
                map: this.map
            });

            // 인포윈도우 생성
            const infowindowContent = `
                <div style="padding:10px;min-width:200px;">
                    <div style="font-weight:bold;margin-bottom:5px;">${place.place_name}</div>
                    <div style="font-size:12px;color:#666;margin-bottom:3px;">${place.category_name}</div>
                    <div style="font-size:12px;color:#666;">${place.road_address_name || place.address_name}</div>
                    ${place.phone ? `<div style="font-size:12px;color:#666;margin-top:3px;">📞 ${place.phone}</div>` : ''}
                </div>
            `;

            const infowindow = new kakao.maps.InfoWindow({
                content: infowindowContent
            });

            // 마커 클릭 이벤트
            kakao.maps.event.addListener(marker, 'click', () => {
                // 다른 인포윈도우들 닫기
                this.infowindows.forEach(iw => iw.close());
                infowindow.open(this.map, marker);
            });

            this.markers.push(marker);
            this.infowindows.push(infowindow);
        });
    }

    displaySearchResults(places) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = places.map((place, index) => `
            <div class="result-item" onclick="searchMapInstance.focusOnMarker(${index})">
                <div class="result-name">${place.place_name}</div>
                <div class="result-category">${place.category_name}</div>
                <div class="result-address">${place.road_address_name || place.address_name}</div>
                ${place.phone ? `<div class="result-phone">📞 ${place.phone}</div>` : ''}
            </div>
        `).join('');
    }

    focusOnMarker(index) {
        if (this.markers[index]) {
            const marker = this.markers[index];
            this.map.setCenter(marker.getPosition());
            this.map.setLevel(2);
            
            // 해당 마커의 인포윈도우 열기
            this.infowindows.forEach(iw => iw.close());
            if (this.infowindows[index]) {
                this.infowindows[index].open(this.map, marker);
            }
        }
    }

    setBoundsFromResults(places) {
        const bounds = new kakao.maps.LatLngBounds();
        
        places.forEach(place => {
            bounds.extend(new kakao.maps.LatLng(place.y, place.x));
        });

        this.map.setBounds(bounds, 80);
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.infowindows.forEach(infowindow => infowindow.close());
        this.markers = [];
        this.infowindows = [];
    }

    showLoading() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading-message">검색 중...</div>';
        }
        
        // 지도 컨테이너 표시
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer) {
            mapContainer.style.display = 'block';
        }
    }

    hideLoading() {
        // 로딩 메시지는 결과로 대체됨
    }

    showNoResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading-message">검색 결과가 없습니다.</div>';
        }
    }

    showError(message) {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = `<div class="loading-message" style="color: #e74c3c;">${message}</div>`;
        }
    }
}

// 전역 인스턴스
let searchMapInstance = null;

// 검색 함수들
async function searchPlaces() {
    const keyword = document.getElementById('mainSearch').value.trim();
    if (!keyword) {
        alert('검색어를 입력해주세요.');
        return;
    }

    if (!searchMapInstance) {
        try {
            await initSearchMap();
        } catch (error) {
            console.error('지도 초기화 실패:', error);
            alert('지도를 불러올 수 없습니다.');
            return;
        }
    }

    // 선택된 카테고리 가져오기
    const selectedCategory = getSelectedCategory();
    searchMapInstance.searchPlaces(keyword, selectedCategory);
}

function quickSearch(keyword) {
    document.getElementById('mainSearch').value = keyword;
    searchPlaces();
}

function getSelectedCategory() {
    const checkedCategory = document.querySelector('.filter-checkbox[value="cafe"]:checked, .filter-checkbox[value="restaurant"]:checked, .filter-checkbox[value="attraction"]:checked, .filter-checkbox[value="culture"]:checked, .filter-checkbox[value="shopping"]:checked');
    return checkedCategory ? checkedCategory.value : '';
}

async function initSearchMap() {
    try {
        searchMapInstance = new SearchMap();
        await searchMapInstance.init();
        console.log('✅ 검색 지도 준비 완료');
    } catch (error) {
        console.error('❌ 검색 지도 초기화 실패:', error);
        throw error;
    }
}

// 엔터키 검색 지원
document.addEventListener('DOMContentLoaded', () => {
    const mainSearch = document.getElementById('mainSearch');
    if (mainSearch) {
        mainSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchPlaces();
            }
        });
    }

    // 사이드바 검색도 지원
    const sidebarSearch = document.querySelector('.sidebar-search');
    if (sidebarSearch) {
        sidebarSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const keyword = sidebarSearch.value.trim();
                if (keyword) {
                    document.getElementById('mainSearch').value = keyword;
                    searchPlaces();
                }
            }
        });
    }
});
