// Browser history management utilities
export class RouteHistory {
  static history = [];
  static maxHistorySize = 10;

  static push(route) {
    this.history.push({
      path: route,
      timestamp: new Date(),
      title: this.getRouteTitle(route)
    });

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Store in localStorage for persistence
    this.saveToStorage();
  }

  static getHistory() {
    return [...this.history];
  }

  static getPreviousRoute() {
    return this.history.length > 1 ? this.history[this.history.length - 2] : null;
  }

  static getLastRoute() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  static clear() {
    this.history = [];
    this.saveToStorage();
  }

  static saveToStorage() {
    try {
      localStorage.setItem('routeHistory', JSON.stringify(this.history));
    } catch (error) {
      console.warn('Could not save route history to localStorage:', error);
    }
  }

  static loadFromStorage() {
    try {
      const stored = localStorage.getItem('routeHistory');
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Could not load route history from localStorage:', error);
      this.history = [];
    }
  }

  static getRouteTitle(path) {
    const routeTitles = {
      '/dashboard': 'Dashboard',
      '/employees': 'Employees',
      '/schedule': 'Schedule',
      '/rules': 'Rules',
      '/analytics': 'Analytics',
      '/settings': 'Settings',
      '/profile': 'Profile',
      '/login': 'Login',
      '/register': 'Register'
    };

    return routeTitles[path] || path;
  }

  static canGoBack() {
    return this.history.length > 1;
  }

  static getBackRoute() {
    if (this.canGoBack()) {
      return this.history[this.history.length - 2].path;
    }
    return '/dashboard'; // Default fallback
  }
}

// Initialize history from storage on load
RouteHistory.loadFromStorage();