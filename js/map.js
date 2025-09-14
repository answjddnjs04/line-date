// js/map.js - 카카오맵 관련 기능
class DateCourseMap {
    constructor() {
        this.map = null;
        this.markers = [];
        this.polylines = [];
        this.colors = [
            '#FF0000', // 빨강 (1->2)
            '#FF8000', // 주황 (2->3)
            '#FFFF00', // 노랑 (3->4)
            '#80FF00', // 연두 (4->5)
            '#00FF00', // 초록 (5->6)
            '#00FF80', // 청록
            '#00FFFF', // 시안
            '#0080FF', // 하늘
            '#0000FF', // 파랑
            '#8000FF', // 보라
            '#FF00FF'  // 자주
        ];
    }

    // 지도 초기화
    async initMap() {
        return new Promise((resolve, reject) => {
            if (typeof kakao === 'undefined') {
                reject(new Error('카카오맵 API가 로드되지 않았습니다.'));
                return;
            }

            kakao.maps.load(() => {
                const container = document.getElementById('map');
                if (!container) {
                    reject(new Error('지도 컨테이너를 찾을 수 없습니다.'));
                    return;
                }
                
                // 컨테이너가 보이는지 확인
                if (container.offsetWidth === 0 || container.offsetHeight === 0) {
                    reject(new Error('지도 컨테이너가 화면에 표시되지 않았습니다.'));
                    return;
                }
                
                const options = {
                    center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 중심
                    level: 3
                };
                
                try {
                    this.map = new kakao.maps.Map(container, options);
                    resolve();
                } catch (error) {
                    reject(new Error(`지도 생성 실패: ${error.message}`));
                }
            });
        });
    }

    // 주소를 좌표로 변환
    async getCoordinates(address) {
        return new Promise((resolve, reject) => {
            if (!address || address === '소재' || address.includes('일대')) {
                resolve(null);
                return;
            }

            const geocoder = new kakao.maps.services.Geocoder();
            geocoder.addressSearch(address, (result, status) => {
                if (status === kakao.maps.services.Status.OK) {
                    resolve({
                        lat: parseFloat(result[0].y),
                        lng: parseFloat(result[0].x)
                    });
                } else {
                    console.warn(`주소 변환 실패: ${address}`);
                    resolve(null);
                }
            });
        });
    }

    // 마커 생성
    createMarker(position, number, title) {
        const markerContent = `
            <div style="
                background: white;
                border: 3px solid #667eea;
                border-radius: 50%;
                width: 35px;
                height: 35px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
                color: #667eea;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">${number}</div>
        `;

        const customOverlay = new kakao.maps.CustomOverlay({
            map: this.map,
            position: position,
            content: markerContent,
            yAnchor: 0.5
        });

        // 인포윈도우
        const infowindow = new kakao.maps.InfoWindow({
            content: `<div style="padding:5px;font-size:12px;">${title}</div>`
        });

        // 마커 클릭 이벤트
        kakao.maps.event.addListener(customOverlay, 'click', () => {
            infowindow.open(this.map, position);
        });

        this.markers.push(customOverlay);
        return customOverlay;
    }

    // 경로 라인 생성
    createPolyline(startPos, endPos, colorIndex) {
        const linePath = [startPos, endPos];
        const color = this.colors[colorIndex % this.colors.length];

        const polyline = new kakao.maps.Polyline({
            path: linePath,
            strokeWeight: 5,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeStyle: 'solid'
        });

        polyline.setMap(this.map);
        this.polylines.push(polyline);
        return polyline;
    }

    // 지도에 데이트 코스 표시
    async displayCourses(courses) {
        this.clearMap();
        
        const validCourses = [];
        
        // 좌표 변환
        for (let i = 0; i < courses.length; i++) {
            const course = courses[i];
            const coords = await this.getCoordinates(course.address);
            
            if (coords) {
                validCourses.push({
                    ...course,
                    position: new kakao.maps.LatLng(coords.lat, coords.lng),
                    number: i + 1
                });
            }
        }

        if (validCourses.length === 0) {
            console.warn('표시할 수 있는 유효한 좌표가 없습니다.');
            return;
        }

        // 마커 생성
        validCourses.forEach(course => {
            this.createMarker(course.position, course.number, course.title);
        });

        // 경로 라인 생성
        for (let i = 0; i < validCourses.length - 1; i++) {
            this.createPolyline(
                validCourses[i].position,
                validCourses[i + 1].position,
                i
            );
        }

        // 지도 범위 조정
        this.fitMapBounds(validCourses);
    }

    // 지도 범위 자동 조정
    fitMapBounds(courses) {
        if (courses.length === 0 || !this.map) return;

        const bounds = new kakao.maps.LatLngBounds();
        courses.forEach(course => {
            bounds.extend(course.position);
        });

        try {
            this.map.setBounds(bounds, 50); // 50px 패딩
        } catch (error) {
            console.error('지도 범위 조정 실패:', error);
        }
    }

    // 지도 초기화
clearMap() {
    try {
        // 기존 마커 제거
        this.markers.forEach(marker => {
            if (marker && typeof marker.setMap === 'function') {
                marker.setMap(null);
            }
        });
        this.markers = [];

        // 기존 라인 제거
        this.polylines.forEach(polyline => {
            if (polyline && typeof polyline.setMap === 'function') {
                polyline.setMap(null);
            }
        });
        this.polylines = [];
        
        // 지도 객체 정리
        if (this.map) {
            this.map = null;
        }
    } catch (error) {
        console.warn('지도 정리 중 오류 무시:', error);
    }
}

    // 특정 코스로 지도 이동
    moveToMarker(courseIndex) {
        if (this.markers[courseIndex]) {
            const marker = this.markers[courseIndex];
            this.map.setCenter(marker.getPosition());
            this.map.setLevel(2);
        }
    }
}

// 전역 인스턴스
let dateCourseMap = null;

// 지도 초기화 함수
async function initializeDateMap() {
    // 지도 컨테이너가 있는지 먼저 확인
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.warn('지도 컨테이너가 아직 생성되지 않았습니다.');
        return false;
    }

    try {
        dateCourseMap = new DateCourseMap();
        await dateCourseMap.initMap();
        console.log('✅ 카카오맵 초기화 완료');
        return true;
    } catch (error) {
        console.error('❌ 지도 초기화 실패:', error);
        return false;
    }
}

// 데이트 코스를 지도에 표시
async function displayDateCourseOnMap(courses) {
    if (!dateCourseMap) {
        console.warn('지도가 초기화되지 않았습니다.');
        return;
    }

    try {
        await dateCourseMap.displayCourses(courses);
        console.log('✅ 데이트 코스 지도 표시 완료');
    } catch (error) {
        console.error('❌ 지도 표시 실패:', error);
    }
}
