// js/location-filter.js - 거리 기반 위치 필터링
class LocationFilter {
    constructor() {
        this.maxDistanceKm = 30; // 최대 직선거리 30km
    }

    // 두 좌표 간 직선거리 계산 (Haversine formula)
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // 지구 반지름 (km)
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    // 위치 기반 필터링
    filterPlacesByDistance(places, targetLocation) {
        if (!targetLocation || places.length === 0) return places;

        return places.filter(place => {
            if (!place.x || !place.y) return true; // 좌표가 없으면 통과
            
            const placeLat = parseFloat(place.y);
            const placeLng = parseFloat(place.x);
            const targetLat = targetLocation.lat;
            const targetLng = targetLocation.lng;
            
            const distance = this.calculateDistance(placeLat, placeLng, targetLat, targetLng);
            return distance <= this.maxDistanceKm;
        });
    }

    // 데이트 코스 간 거리 검증
    validateCourseDistances(courses) {
        const results = [];
        
        for (let i = 0; i < courses.length - 1; i++) {
            const current = courses[i];
            const next = courses[i + 1];
            
            if (current.coordinates && next.coordinates) {
                const distance = this.calculateDistance(
                    current.coordinates.lat,
                    current.coordinates.lng,
                    next.coordinates.lat,
                    next.coordinates.lng
                );
                
                results.push({
                    from: current.title,
                    to: next.title,
                    distance: Math.round(distance * 100) / 100,
                    isValid: distance <= this.maxDistanceKm
                });
            }
        }
        
        return results;
    }

    // 위치명으로 대표 좌표 추출
    async extractLocationCoordinates(locationName) {
        return new Promise((resolve, reject) => {
            if (typeof kakao === 'undefined') {
                resolve(null);
                return;
            }

            const geocoder = new kakao.maps.services.Geocoder();
            geocoder.addressSearch(locationName, (result, status) => {
                if (status === kakao.maps.services.Status.OK && result.length > 0) {
                    resolve({
                        lat: parseFloat(result[0].y),
                        lng: parseFloat(result[0].x)
                    });
                } else {
                    // 키워드 검색으로 재시도
                    const places = new kakao.maps.services.Places();
                    places.keywordSearch(locationName, (data, status) => {
                        if (status === kakao.maps.services.Status.OK && data.length > 0) {
                            resolve({
                                lat: parseFloat(data[0].y),
                                lng: parseFloat(data[0].x)
                            });
                        } else {
                            resolve(null);
                        }
                    });
                }
            });
        });
    }
}

// 전역 인스턴스
const locationFilter = new LocationFilter();
