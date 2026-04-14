const AUTH = {
    loadUsers() {
        try {
            return JSON.parse(localStorage.getItem('users')) || {};
        } catch {
            return {};
        }
    },

    saveUsers(users) {
        localStorage.setItem('users', JSON.stringify(users));
    },

    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('currentUser')) || null;
        } catch {
            return null;
        }
    },

    saveCurrentUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    },

    isLoggedIn() {
        return Boolean(this.getCurrentUser());
    },

    login(email, password) {
        const users = this.loadUsers();
        const user = users[email.toLowerCase()];

        if (!user || user.password !== password) {
            return { success: false, message: 'Väärä sähköposti tai salasana' };
        }

        this.saveCurrentUser({
            email: email.toLowerCase(),
            name: user.name,
            phone: user.phone || '',
            avatar: user.avatar || '',
            favorites: user.favorites || [],
        });

        return { success: true };
    },

    register(name, email, password) {
        const users = this.loadUsers();
        const normalizedEmail = email.toLowerCase();

        if (users[normalizedEmail]) {
            return { success: false, message: 'Sähköposti on jo käytössä' };
        }

        users[normalizedEmail] = {
            name,
            password,
            phone: '',
            avatar: '',
            favorites: [],
        };

        this.saveUsers(users);
        this.saveCurrentUser({
            email: normalizedEmail,
            name,
            phone: '',
            avatar: '',
            favorites: [],
        });

        return { success: true };
    },

    logout() {
        localStorage.removeItem('currentUser');
    },

    updateProfile(updates) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            return { success: false, message: 'Ei kirjautunutta käyttäjää' };
        }

        const users = this.loadUsers();
        const user = users[currentUser.email];
        if (!user) {
            return { success: false, message: 'Käyttäjää ei löytynyt' };
        }

        const nextUser = {
            ...user,
            ...updates,
            favorites: user.favorites || currentUser.favorites || [],
        };

        users[currentUser.email] = nextUser;
        this.saveUsers(users);
        this.saveCurrentUser({
            email: currentUser.email,
            name: nextUser.name,
            phone: nextUser.phone || '',
            avatar: nextUser.avatar || '',
            favorites: nextUser.favorites || [],
        });

        return { success: true };
    },

    addFavorite(restaurantId) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            return { success: false, message: 'Ei kirjautunutta käyttäjää' };
        }

        const users = this.loadUsers();
        const user = users[currentUser.email];
        const favorites = new Set(user?.favorites || currentUser.favorites || []);
        favorites.add(restaurantId);

        users[currentUser.email] = {
            ...(user || {}),
            ...currentUser,
            favorites: [...favorites],
        };

        this.saveUsers(users);
        this.saveCurrentUser(users[currentUser.email]);
        return { success: true };
    },

    removeFavorite(restaurantId) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            return { success: false, message: 'Ei kirjautunutta käyttäjää' };
        }

        const users = this.loadUsers();
        const user = users[currentUser.email];
        const favorites = (user?.favorites || currentUser.favorites || []).filter((id) => id !== restaurantId);

        users[currentUser.email] = {
            ...(user || {}),
            ...currentUser,
            favorites,
        };

        this.saveUsers(users);
        this.saveCurrentUser(users[currentUser.email]);
        return { success: true };
    },

    isFavorite(restaurantId) {
        const currentUser = this.getCurrentUser();
        return Boolean(currentUser?.favorites?.includes(restaurantId));
    },
};
