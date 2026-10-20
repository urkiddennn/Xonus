/* Xonus site interactions: nav, copy buttons, tabs, reveal, docs scrollspy. */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- nav */
  const nav = document.querySelector('.site-nav');
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  const onScroll = () => {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!open));
      navLinks.classList.toggle('is-open', !open);
    });

    navLinks.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        navToggle.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('is-open');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navLinks.classList.contains('is-open')) {
        navToggle.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('is-open');
        navToggle.focus();
      }
    });
  }

  /* ------------------------------------------------------- copy buttons */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    }
  };

  document.querySelectorAll('.codeblock').forEach((block) => {
    const code = block.querySelector('pre code');
    const button = block.querySelector('.copy-btn');
    if (!code || !button) return;

    button.addEventListener('click', async () => {
      const ok = await copyText(code.textContent || '');
      button.textContent = ok ? 'Copied' : 'Failed';
      button.classList.toggle('copied', ok);
      window.setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('copied');
      }, 1600);
    });
  });

  /* --------------------------------------------------------------- tabs */
  document.querySelectorAll('[data-tabs]').forEach((tabs) => {
    const buttons = Array.from(tabs.querySelectorAll('[role="tab"]'));
    const panels = buttons
      .map((button) => document.getElementById(button.getAttribute('aria-controls') || ''))
      .filter(Boolean);

    const select = (index) => {
      buttons.forEach((button, i) => {
        const active = i === index;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      panels.forEach((panel, i) => {
        panel.hidden = i !== index;
      });
    };

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const next = (index + direction + buttons.length) % buttons.length;
        select(next);
        buttons[next]?.focus();
      });
    });

    select(Math.max(0, buttons.findIndex((b) => b.getAttribute('aria-selected') === 'true')));
  });

  /* ------------------------------------------------------------- reveal */
  const revealItems = document.querySelectorAll('.reveal');
  if (revealItems.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px' },
      );
      revealItems.forEach((item) => observer.observe(item));
    }
  }

  /* ------------------------------------------------- mobile docs navigation */
  const mobileDocsNav = document.querySelector('.docs-mobile-nav nav');
  const sidebarDocsNav = document.querySelector('.docs-sidebar nav');
  if (mobileDocsNav && sidebarDocsNav) {
    mobileDocsNav.innerHTML = sidebarDocsNav.innerHTML;
    mobileDocsNav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        mobileDocsNav.closest('details')?.removeAttribute('open');
      }
    });
  }

  /* ------------------------------------------------------ docs scrollspy */
  const docLinks = Array.from(document.querySelectorAll('[data-doc-link]'));
  const sections = Array.from(document.querySelectorAll('.doc-section[id]'));

  if (docLinks.length && sections.length && 'IntersectionObserver' in window) {
    const byId = new Map();
    docLinks.forEach((link) => {
      const id = (link.getAttribute('href') || '').replace(/^#/, '');
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(link);
    });

    const setActive = (id) => {
      docLinks.forEach((link) => link.classList.remove('active'));
      (byId.get(id) || []).forEach((link) => link.classList.add('active'));
    };

    const spy = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-18% 0px -68% 0px', threshold: 0 },
    );

    sections.forEach((section) => spy.observe(section));
    setActive(sections[0]?.id || '');
  }

  /* ---------------------------------------------------------------- year */
  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
