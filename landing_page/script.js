// Kayko Landing Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for navigation links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Navbar background on scroll
  const navbar = document.querySelector('.navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      navbar.style.background = 'rgba(10, 10, 15, 0.95)';
      navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    } else {
      navbar.style.background = 'rgba(10, 10, 15, 0.8)';
      navbar.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
  });

  // Intersection Observer for fade-in animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in-visible');
        fadeInObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Add fade-in animation to sections
  document.querySelectorAll('.feature-card, .step, .platform-card, .privacy-list li').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    fadeInObserver.observe(el);
  });

  // Add the visible class styles
  const style = document.createElement('style');
  style.textContent = `
    .fade-in-visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  document.head.appendChild(style);

  // Typing animation for the demo
  const typingText = document.querySelector('.typing-text');
  if (typingText) {
    const texts = [
      'Write a Python function that...',
      'Explain how neural networks...',
      'Create a marketing email for...',
      'Debug this React component...',
      'Summarize this article about...'
    ];
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;

    function typeText() {
      const currentText = texts[textIndex];
      
      if (isDeleting) {
        typingText.textContent = currentText.substring(0, charIndex - 1);
        charIndex--;
        typingSpeed = 50;
      } else {
        typingText.textContent = currentText.substring(0, charIndex + 1);
        charIndex++;
        typingSpeed = 100;
      }

      if (!isDeleting && charIndex === currentText.length) {
        isDeleting = true;
        typingSpeed = 2000; // Pause at end
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
        typingSpeed = 500; // Pause before next text
      }

      setTimeout(typeText, typingSpeed);
    }

    setTimeout(typeText, 1000);
  }

  // Cat mascot eye tracking (subtle)
  const catMascot = document.querySelector('.cat-mascot');
  if (catMascot) {
    document.addEventListener('mousemove', (e) => {
      const eyes = catMascot.querySelectorAll('.cat-eye-left, .cat-eye-right');
      const shines = catMascot.querySelectorAll('[class*="eye-shine"]');
      
      const rect = catMascot.getBoundingClientRect();
      const catCenterX = rect.left + rect.width / 2;
      const catCenterY = rect.top + rect.height / 2;
      
      const deltaX = (e.clientX - catCenterX) / 50;
      const deltaY = (e.clientY - catCenterY) / 50;
      
      // Limit movement
      const maxMove = 3;
      const moveX = Math.max(-maxMove, Math.min(maxMove, deltaX));
      const moveY = Math.max(-maxMove, Math.min(maxMove, deltaY));
      
      shines.forEach(shine => {
        shine.style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    });
  }

  // Floating prompts random delay
  document.querySelectorAll('.floating-prompt').forEach((prompt, index) => {
    prompt.style.animationDelay = `${index * 0.5}s`;
  });

  // Platform cards hover effect
  document.querySelectorAll('.platform-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-8px) scale(1.02)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0) scale(1)';
    });
  });

  // Stats counter animation
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateStats();
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  const statsSection = document.querySelector('.hero-stats');
  if (statsSection) {
    statsObserver.observe(statsSection);
  }

  function animateStats() {
    document.querySelectorAll('.stat-value').forEach(stat => {
      const finalValue = stat.textContent;
      const isNumber = !isNaN(parseInt(finalValue));
      
      if (isNumber) {
        const target = parseInt(finalValue);
        let current = 0;
        const increment = target / 30;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            stat.textContent = finalValue;
            clearInterval(timer);
          } else {
            stat.textContent = Math.floor(current);
          }
        }, 50);
      }
    });
  }

  // Add subtle parallax to hero gradient
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroGradient = document.querySelector('.hero-gradient');
    if (heroGradient && scrolled < window.innerHeight) {
      heroGradient.style.transform = `translateX(-50%) translateY(${scrolled * 0.3}px)`;
    }
  });

  // CTA button click tracking (for analytics - placeholder)
  document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('CTA clicked:', btn.textContent.trim());
      // Add your analytics tracking here
    });
  });

  console.log('🐱 Kayko Landing Page Loaded');
});

