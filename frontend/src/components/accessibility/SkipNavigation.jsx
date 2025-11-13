import React from 'react';

/**
 * Skip Navigation component for keyboard users
 * Allows users to skip repetitive navigation and jump directly to main content
 * WCAG 2.1 Success Criterion 2.4.1 (Level A)
 */
const SkipNavigation = () => {
  const skipToMain = (e) => {
    e.preventDefault();
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href="#main-content"
      onClick={skipToMain}
      className="skip-navigation"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        zIndex: 999,
        padding: '1em',
        backgroundColor: '#000',
        color: '#fff',
        textDecoration: 'none',
        fontWeight: 'bold',
        borderRadius: '4px',
        outline: '2px solid #fff'
      }}
      onFocus={(e) => {
        e.target.style.left = '0';
        e.target.style.width = 'auto';
        e.target.style.height = 'auto';
        e.target.style.overflow = 'visible';
        e.target.style.margin = '0.5em';
      }}
      onBlur={(e) => {
        e.target.style.left = '-9999px';
        e.target.style.width = '1px';
        e.target.style.height = '1px';
        e.target.style.overflow = 'hidden';
        e.target.style.margin = '0';
      }}
    >
      Skip to main content
    </a>
  );
};

export default SkipNavigation;
