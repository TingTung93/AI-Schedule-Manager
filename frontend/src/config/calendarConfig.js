/**
 * Mobile-responsive calendar configuration
 * Provides adaptive settings based on screen size
 */

/**
 * Get mobile-optimized calendar configuration
 * @param {boolean} isMobile - Screen width < 900px
 * @param {boolean} isTablet - Screen width 900-1200px
 * @returns {object} FullCalendar configuration object
 */
export const getMobileCalendarConfig = (isMobile, isTablet) => {
  // Base configuration for all devices
  const baseConfig = {
    weekends: true,
    navLinks: !isMobile, // Disable navigation links on mobile
    dayMaxEvents: true,
    slotEventOverlap: false,
  };

  // Mobile configuration (< 900px)
  if (isMobile) {
    return {
      ...baseConfig,
      initialView: 'timeGridDay',
      headerToolbar: {
        left: 'prev,next',
        center: 'title',
        right: 'today'
      },
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      slotDuration: '01:00:00',
      slotLabelInterval: '01:00',
      eventMinHeight: 50, // Touch-friendly minimum height (iOS guideline: 44px)
      height: 'auto',
      contentHeight: 600,
      editable: false, // Disable drag-drop on mobile
      droppable: false,
      eventResizableFromStart: false,
      eventDurationEditable: false,
      selectable: true,
      selectMirror: true,
      titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
      slotLabelFormat: {
        hour: 'numeric',
        minute: '2-digit',
        meridiem: 'short'
      },
      dayHeaderFormat: { weekday: 'short', day: 'numeric' },
      eventTimeFormat: {
        hour: 'numeric',
        minute: '2-digit',
        meridiem: 'short'
      }
    };
  }

  // Tablet configuration (900-1200px)
  if (isTablet) {
    return {
      ...baseConfig,
      initialView: 'timeGridThreeDay',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridDay,timeGridThreeDay,timeGridWeek'
      },
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      slotDuration: '00:30:00',
      slotLabelInterval: '01:00',
      eventMinHeight: 40,
      height: 'auto',
      contentHeight: 700,
      editable: true,
      droppable: true,
      eventResizableFromStart: true,
      eventDurationEditable: true,
      selectable: true,
      selectMirror: true,
      dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric' }
    };
  }

  // Desktop configuration (> 1200px)
  return {
    ...baseConfig,
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00',
    eventMinHeight: 30,
    height: 'auto',
    contentHeight: 800,
    editable: true,
    droppable: true,
    eventResizableFromStart: true,
    eventDurationEditable: true,
    selectable: true,
    selectMirror: true,
    dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true }
  };
};

/**
 * Get initial view based on screen size
 * @param {boolean} isMobile - Screen width < 900px
 * @param {boolean} isTablet - Screen width 900-1200px
 * @returns {string} FullCalendar view name
 */
export const getInitialView = (isMobile, isTablet) => {
  if (isMobile) return 'timeGridDay';
  if (isTablet) return 'timeGridThreeDay';
  return 'timeGridWeek';
};

/**
 * Get button text configuration based on screen size
 * @param {boolean} isMobile - Screen width < 900px
 * @returns {object} Button text configuration
 */
export const getButtonText = (isMobile) => {
  if (isMobile) {
    return {
      today: 'Today',
      day: 'Day',
      week: 'Week',
      month: 'Month'
    };
  }

  return {
    today: 'Today',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    list: 'List'
  };
};

/**
 * Custom view definitions for responsive calendar
 */
export const customViews = {
  timeGridThreeDay: {
    type: 'timeGrid',
    duration: { days: 3 },
    buttonText: '3 Days'
  }
};
