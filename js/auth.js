/**
 * BTS Progress Tracker - Authentication Module
 */
const Auth = {
  async login(username, password) {
    if (!username || !password) {
      return { success: false, message: 'Vui lòng nhập đầy đủ thông tin' };
    }

    try {
      const result = await DataService.login(username, password);
      if (result.success) {
        Storage.setSession(result.user);
      }
      return result;
    } catch (error) {
      return { success: false, message: 'Lỗi kết nối server: ' + error.message };
    }
  },

  logout() {
    Storage.clearSession();
  },

  getCurrentUser() {
    const session = Storage.getSession();
    return session || null;
  },

  getUsername() {
    const user = this.getCurrentUser();
    return user ? user.username : '';
  },

  getDisplayName() {
    const user = this.getCurrentUser();
    return user ? (user.displayName || user.username) : '';
  },

  getRole() {
    const user = this.getCurrentUser();
    if (!user) return 'view';
    if (user.role) return user.role.toLowerCase();
    if (user.username && user.username.toLowerCase() === 'admin') return 'admin';
    return 'view'; 
  },

  isLoggedIn() {
    return Storage.isLoggedIn();
  }
};
