// js/duplicate-handler.js - 중복 장소 처리
class DuplicateHandler {
    constructor() {
        // 중복 금지 카테고리 (한 번만 방문하는 곳)
        this.noDuplicateCategories = [
            '음식점', '카페', '레스토랑', '식당', '브런치', '디저트카페',
            '이탈리안', '한식', '중식', '일식', '양식', '바', '펜지'
        ];
        
        // 중복 허용 장소 (여러 활동 가능한 곳)
        this.allowDuplicateTypes = [
            '공원', '호수', '강', '바다', '해변', '산', '등산로', '산책로',
            '놀이공원', '테마파크', '워터파크', '스키장', '박물관', '미술관',
            '전시관', '문화센터', '쇼핑몰', '백화점', '시장', '거리', '광장'
        ];
        
        this.usedPlaces = new Map(); // 사용된 장소 추적
    }

    // 장소가 중복 허용 타입인지 확인
    isAllowDuplicatePlace(placeName, category) {
        const name = placeName.toLowerCase();
        const cat = category.toLowerCase();
        
        return this.allowDuplicateTypes.some(type => 
            name.includes(type) || cat.includes(type)
        );
    }

    // 장소가 중복 금지 카테고리인지 확인
    isNoDuplicateCategory(category, searchKeyword) {
        const combined = `${category} ${searchKeyword}`.toLowerCase();
        
        return this.noDuplicateCategories.some(forbidden => 
            combined.includes(forbidden)
        );
    }

    // 중복 처리 로직
    handleDuplicatePlace(newCourse, existingCourses) {
        const placeName = newCourse.location;
        const category = newCourse.category || '';
        const searchKeyword = newCourse.searchKeyword || '';
        
        // 기존 코스에서 같은 장소 찾기
        const existingCourse = existingCourses.find(course => 
            course.location === placeName
        );
        
        if (!existingCourse) {
            // 중복 아님 - 새로 추가
            this.usedPlaces.set(placeName, [newCourse.title]);
            return newCourse;
        }
        
        // 중복된 경우
        if (this.isNoDuplicateCategory(category, searchKeyword)) {
            // 중복 금지 카테고리 - 다른 장소 찾아야 함
            console.log(`❌ 중복 금지: ${placeName} (${category})`);
            return null; // 다른 장소로 대체 필요
        }
        
        if (this.isAllowDuplicatePlace(placeName, category)) {
            // 중복 허용 - 기존 장소에 번호 추가
            console.log(`✅ 중복 허용: ${placeName}`);
            this.usedPlaces.get(placeName).push(newCourse.title);
            
            return {
                ...newCourse,
                isDuplicate: true,
                duplicateNumbers: this.getDuplicateNumbers(placeName)
            };
        }
        
        // 기본적으로 중복 금지
        console.log(`⚠️ 기본 중복 금지: ${placeName}`);
        return null;
    }

    // 중복 장소의 번호들 반환
    getDuplicateNumbers(placeName) {
        const activities = this.usedPlaces.get(placeName) || [];
        return activities.length;
    }

    // 사용 가능한 대체 장소 찾기
    findAlternativePlace(places, usedPlaceNames, category, searchKeyword) {
        // 이미 사용된 장소들 제외
        const availablePlaces = places.filter(place => {
            // 중복 금지 카테고리면서 이미 사용된 장소는 제외
            if (this.isNoDuplicateCategory(category, searchKeyword)) {
                return !usedPlaceNames.includes(place.name);
            }
            return true;
        });
        
        return availablePlaces.length > 0 ? availablePlaces[0] : null;
    }

    // 초기화
    reset() {
        this.usedPlaces.clear();
    }
}

// 전역 인스턴스
const duplicateHandler = new DuplicateHandler();
