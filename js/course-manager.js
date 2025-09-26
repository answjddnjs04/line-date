// js/course-manager.js - 코스 관리 시스템
class CourseManager {
    constructor() {
        this.courses = new Map(); // 번호 -> 장소 정보
        this.minNumber = 1;
        this.maxNumber = 1;
        this.maxCourses = 6; // 최대 코스 개수
    }

    // 빈 슬롯 추가 (나중에 실제 장소로 대체될 임시 슬롯)
    addEmptySlot(number) {
        const emptyPlace = {
            name: `${number}번 코스`,
            address: '장소를 선택해주세요',
            phone: '',
            url: '',
            coordinates: { lat: 0, lng: 0 },
            isEmpty: true
        };
        
        this.courses.set(number, emptyPlace);
        this.updateMinMax();
        console.log(`빈 슬롯 ${number}번 추가`);
    }
    
    // 최소/최대 번호 업데이트
    updateMinMax() {
        const numbers = Array.from(this.courses.keys());
        if (numbers.length > 0) {
            this.minNumber = Math.min(...numbers);
            this.maxNumber = Math.max(...numbers);
        }
    }

    // 장소 추가
    addPlace(number, place) {
        this.courses.set(number, place);
        console.log(`코스 ${number}번 추가:`, place.name);
        this.updateCourseDisplay();
    }

    // 장소 제거
    removePlace(number) {
        if (this.courses.has(number)) {
            const place = this.courses.get(number);
            this.courses.delete(number);
            console.log(`코스 ${number}번 제거:`, place.name);
            this.updateCourseDisplay();
        }
    }

    // 다음 슬롯 번호 계산
    getNextSlotNumber(direction) {
        if (this.courses.size >= this.maxCourses) {
            return null; // 최대 개수 초과
        }

        if (direction === 'left') {
            // 왼쪽은 0, -1, -2... 순으로
            const newNumber = this.minNumber - 1;
            this.minNumber = newNumber;
            return newNumber;
        } else {
            // 오른쪽은 2, 3, 4... 순으로
            const newNumber = this.maxNumber + 1;
            this.maxNumber = newNumber;
            return newNumber;
        }
    }

    // 코스 목록 반환 (번호순 정렬)
    getSortedCourses() {
        const sortedNumbers = Array.from(this.courses.keys()).sort((a, b) => a - b);
        return sortedNumbers.map(number => ({
            number,
            place: this.courses.get(number)
        }));
    }

    // 코스 개수 반환
    getCourseCount() {
        return this.courses.size;
    }

    // 특정 번호의 장소 존재 여부
    hasPlace(number) {
        return this.courses.has(number);
    }

    // 특정 번호의 장소 정보 반환
    getPlace(number) {
        return this.courses.get(number);
    }

    // 코스 표시 업데이트
    updateCourseDisplay() {
        const courseList = document.getElementById('courseList');
        if (!courseList) return;

        const sortedCourses = this.getSortedCourses();
        if (sortedCourses.length === 0) return;

        // 코스 표시 업데이트
        this.displayCoursesInHeader(sortedCourses);
        this.updateDetailCourseContent(sortedCourses);
        this.updateMapMarkers(sortedCourses);
    }

    // 헤더의 코스 표시 업데이트
    displayCoursesInHeader(sortedCourses) {
        const courseList = document.getElementById('courseList');
        courseList.innerHTML = '';

        const colors = ['#FF0000', '#FF8000', '#FFFF00', '#00FF00', '#0080FF', '#8000FF'];
        
        // 표시할 번호들을 순서대로 배열
        const displayNumbers = sortedCourses.map(course => course.number);
        const count = displayNumbers.length;
        
        // 크기 설정
        const sizeConfig = {
            1: { boxSize: 50, arrowWidth: 16, gap: 10, fontSize: '0.7rem', numberSize: 18 },
            2: { boxSize: 50, arrowWidth: 16, gap: 10, fontSize: '0.7rem', numberSize: 18 },
            3: { boxSize: 50, arrowWidth: 16, gap: 10, fontSize: '0.7rem', numberSize: 18 },
            4: { boxSize: 52, arrowWidth: 16, gap: 6, fontSize: '0.7rem', numberSize: 18 },
            5: { boxSize: 44, arrowWidth: 14, gap: 4, fontSize: '0.65rem', numberSize: 16 },
            6: { boxSize: 48, arrowWidth: 12, gap: 1, fontSize: '0.6rem', numberSize: 16 }
        };
        
        const config = sizeConfig[count];
        
        sortedCourses.forEach((courseData, index) => {
            const { number, place } = courseData;
            const colorIndex = Math.abs(number) % colors.length;
            
            // 코스 아이템 컨테이너
            const courseItem = document.createElement('div');
            courseItem.className = 'course-item';
            courseItem.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
            `;
            
            // 코스 박스
            const courseBox = document.createElement('div');
            courseBox.className = 'course-box';
            courseBox.style.cssText = `
                width: ${config.boxSize}px;
                height: ${config.boxSize}px;
                background-color: ${colors[colorIndex]};
                border: 2px solid white;
                border-radius: 8px;
                position: relative;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;
            
            // 코스 번호
            const courseNumber = document.createElement('div');
            courseNumber.className = 'course-number';
            courseNumber.textContent = number;
            courseNumber.style.cssText = `
                position: absolute;
                top: -2px;
                left: -2px;
                transform: translate(-50%, -50%);
                width: ${config.numberSize}px;
                height: ${config.numberSize}px;
                background-color: white;
                color: #333;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${config.numberSize * 0.65}px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                z-index: 10;
            `;
            
            // 코스 이름
            const courseName = document.createElement('div');
            courseName.className = 'course-name';
            courseName.textContent = place.name.length > 8 ? place.name.substring(0, 8) + '...' : place.name;
            courseName.style.cssText = `
                font-size: ${config.fontSize};
                color: white;
                text-align: center;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: ${config.boxSize + 10}px;
            `;
            
            courseBox.appendChild(courseNumber);
            courseItem.appendChild(courseBox);
            courseItem.appendChild(courseName);
            courseList.appendChild(courseItem);
            
            // 화살표 추가 (마지막 항목 제외)
            if (index < count - 1) {
                const arrow = document.createElement('div');
                arrow.className = 'course-arrow';
                arrow.textContent = '>';
                arrow.style.cssText = `
                    color: white;
                    font-size: ${config.arrowWidth}px;
                    font-weight: bold;
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    width: ${config.arrowWidth}px;
                    height: ${config.boxSize}px;
                    padding-top: ${config.boxSize * 0.3}px;
                    margin: 0 ${config.gap}px;
                    flex-shrink: 0;
                `;
                
                courseList.appendChild(arrow);
            }
        });
    }

    // 세부 코스 내용 업데이트
    updateDetailCourseContent(sortedCourses) {
        const detailCourseContent = document.getElementById('detailCourseContent');
        if (!detailCourseContent) return;

        const coursesHtml = sortedCourses.map(({ number, place }) => {
            const colorMap = {
                '-2': '#FF0000', '-1': '#FF8000', '0': '#FFFF00', 
                '1': '#FF4444', '2': '#0080FF', '3': '#00FF00',
                '4': '#8000FF', '5': '#FF00FF', '6': '#00FFFF'
            };
            const color = colorMap[number] || '#666666';
            
            return `
                <div class="course-detail-item" style="
                    background: white;
                    border: 2px solid #e8ecf4;
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 15px;
                    position: relative;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                ">
                    <div style="
                        position: absolute;
                        top: 15px;
                        left: 15px;
                        background: ${color};
                        color: white;
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 1.1rem;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    ">${number}</div>
                    
                    <div style="margin-left: 50px;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #2c3e50; margin-bottom: 8px;">
                            ${place.name}
                        </div>
                        <div style="color: #6c7b8a; margin-bottom: 8px;">
                            📍 ${place.address}
                        </div>
                        ${place.phone ? `<div style="color: #6c7b8a; font-size: 0.9rem;">📞 ${place.phone}</div>` : ''}
                        
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <a href="${place.url}" target="_blank" style="
                                background: #fee500;
                                color: #000;
                                padding: 8px 16px;
                                border-radius: 8px;
                                text-decoration: none;
                                font-weight: 600;
                                font-size: 0.9rem;
                            ">카카오맵</a>
                            
                            <button onclick="locationSearchHandler.courseManager.removePlace(${number})" style="
                                background: #e74c3c;
                                color: white;
                                padding: 8px 16px;
                                border: none;
                                border-radius: 8px;
                                font-weight: 600;
                                font-size: 0.9rem;
                                cursor: pointer;
                            ">삭제</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        detailCourseContent.innerHTML = coursesHtml;
    }

    // 지도 마커 업데이트
    updateMapMarkers(sortedCourses) {
        if (!searchMapInstance || !searchMapInstance.map) return;
        if (!locationSearchHandler) return;

        // 기존 마커 제거
        locationSearchHandler.clearMarkers();

        const colorMap = {
            '-2': '#FF0000', '-1': '#FF8000', '0': '#FFFF00', 
            '1': '#FF4444', '2': '#0080FF', '3': '#00FF00',
            '4': '#8000FF', '5': '#FF00FF', '6': '#00FFFF'
        };

        const bounds = new kakao.maps.LatLngBounds();
        
        sortedCourses.forEach(({ number, place }) => {
            const position = new kakao.maps.LatLng(place.coordinates.lat, place.coordinates.lng);
            const color = colorMap[number] || '#666666';
            
            // 번호 마커 생성
            const markerContent = document.createElement('div');
            markerContent.style.cssText = `
                background: ${color};
                color: white;
                width: 35px;
                height: 35px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 16px;
                border: 3px solid white;
                box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                cursor: pointer;
            `;
            markerContent.textContent = number;

            const customOverlay = new kakao.maps.CustomOverlay({
                position: position,
                content: markerContent,
                yAnchor: 0.5
            });

            customOverlay.setMap(searchMapInstance.map);
            locationSearchHandler.markers.push(customOverlay);
            
            bounds.extend(position);
        });

        // 지도 범위 조정
        if (sortedCourses.length > 1) {
            searchMapInstance.map.setBounds(bounds, 80);
        } else {
            searchMapInstance.map.setCenter(new kakao.maps.LatLng(
                sortedCourses[0].place.coordinates.lat,
                sortedCourses[0].place.coordinates.lng
            ));
            searchMapInstance.map.setLevel(4);
        }
    }
}
