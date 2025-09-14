// js/supabase.js - Supabase 클라이언트 설정
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2'

class SupabaseClient {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.init();
    }

    async init() {
        try {
            // 환경변수에서 Supabase 설정 가져오기
            const config = await this.getSupabaseConfig();
            
            if (config.url && config.anonKey) {
                this.supabase = createClient(config.url, config.anonKey);
                console.log('✅ Supabase 클라이언트 초기화 완료');
                
                // 현재 사용자 세션 확인
                await this.getCurrentUser();
                
                // 인증 상태 변화 감지
                this.supabase.auth.onAuthStateChange((event, session) => {
                    console.log('인증 상태 변화:', event, session?.user?.email);
                    this.currentUser = session?.user || null;
                    this.updateUIForAuthState();
                });
            } else {
                console.warn('Supabase 설정을 찾을 수 없습니다');
            }
        } catch (error) {
            console.error('Supabase 초기화 실패:', error);
        }
    }

    async getSupabaseConfig() {
        try {
            const response = await fetch('/api/get-supabase-config');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn('서버에서 Supabase 설정을 가져올 수 없습니다:', error);
        }

        // 로컬 개발용 설정 (실제 배포시에는 환경변수 사용)
        return {
            url: localStorage.getItem('SUPABASE_URL') || '',
            anonKey: localStorage.getItem('SUPABASE_ANON_KEY') || ''
        };
    }

    async getCurrentUser() {
        if (!this.supabase) return null;
        
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (error) throw error;
            
            this.currentUser = user;
            return user;
        } catch (error) {
            console.log('현재 사용자 없음:', error.message);
            return null;
        }
    }

    async signUp(email, password, userData = {}) {
    if (!this.supabase) throw new Error('Supabase가 초기화되지 않았습니다');
    
    try {
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: userData,
                emailRedirectTo: undefined // 이메일 인증 링크 비활성화
            }
        });
        
        if (error) throw error;
        
        console.log('✅ 회원가입 성공:', data.user?.email);
        
        // 이메일 인증이 비활성화되어 있다면 사용자가 바로 인증됨
        if (data.user && !data.user.email_confirmed_at) {
            console.log('📧 이메일 인증 대기 중...');
        }
        
        this.currentUser = data.user;
        return { success: true, user: data.user, needsConfirmation: !data.session };
    } catch (error) {
        console.error('회원가입 실패:', error);
        return { success: false, error: error.message };
    }
}

    async signIn(email, password) {
        if (!this.supabase) throw new Error('Supabase가 초기화되지 않았습니다');
        
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            console.log('✅ 로그인 성공:', data.user?.email);
            this.currentUser = data.user;
            return { success: true, user: data.user };
        } catch (error) {
            console.error('로그인 실패:', error);
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        if (!this.supabase) return;
        
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            console.log('✅ 로그아웃 완료');
            this.currentUser = null;
            return { success: true };
        } catch (error) {
            console.error('로그아웃 실패:', error);
            return { success: false, error: error.message };
        }
    }

    updateUIForAuthState() {
        // 인증 상태에 따른 UI 업데이트
        const isLoggedIn = !!this.currentUser;
        
        // 로그인/로그아웃 버튼 상태 업데이트
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const userInfo = document.getElementById('userInfo');
        
        if (loginBtn && logoutBtn) {
            if (isLoggedIn) {
                loginBtn.style.display = 'none';
                logoutBtn.style.display = 'block';
                if (userInfo) {
                    userInfo.textContent = `안녕하세요, ${this.currentUser.email}님!`;
                    userInfo.style.display = 'block';
                }
            } else {
                loginBtn.style.display = 'block';
                logoutBtn.style.display = 'none';
                if (userInfo) {
                    userInfo.style.display = 'none';
                }
            }
        }

        // 인증이 필요한 기능 활성화/비활성화
        this.toggleAuthRequiredFeatures(isLoggedIn);
    }

    toggleAuthRequiredFeatures(isLoggedIn) {
        const authRequiredElements = document.querySelectorAll('.auth-required');
        authRequiredElements.forEach(element => {
            if (isLoggedIn) {
                element.classList.remove('disabled');
                element.removeAttribute('disabled');
            } else {
                element.classList.add('disabled');
                element.setAttribute('disabled', 'true');
            }
        });
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    getUserEmail() {
        return this.currentUser?.email || null;
    }

    getUserId() {
        return this.currentUser?.id || null;
    }
}

// 전역 인스턴스
const supabaseClient = new SupabaseClient();

// 전역으로 접근 가능하게 설정
window.supabaseClient = supabaseClient;
