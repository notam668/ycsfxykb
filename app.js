/**
 * 盐小师课表查询系统 - 核心逻辑驱动
 */

(function () {
  // Global Data & App State
  const data = window.SCHEDULE_DATA || [];
  
  // Section Time Slots Mapping
  const TIME_SLOTS = {
    1: '08:00', 2: '09:35',
    3: '10:05', 4: '11:40',
    5: '11:50-12:30',
    6: '14:00', 7: '15:35',
    8: '15:55', 9: '17:30',
    10: '18:30', 11: '19:40', 12: '20:55'
  };

  function getCalculatedAcademicWeek() {
    return 4; // Default sensible academic week
  }

  let state = {
    currentMajor: null,
    currentClass: null,
    currentWeek: getCalculatedAcademicWeek(),
    viewMode: 'weekly', // 'weekly' or 'total'
    theme: localStorage.getItem('ys_theme') || 'light'
  };

  // Hash function to assign consistent palette themes to courses
  function getCourseThemeClass(courseName) {
    let hash = 0;
    for (let i = 0; i < courseName.length; i++) {
      hash = (hash << 5) - hash + courseName.charCodeAt(i);
      hash |= 0;
    }
    const themeIdx = Math.abs(hash) % 8;
    return `c-theme-${themeIdx}`;
  }

  // DOM Elements Cache
  const elements = {
    body: document.body,
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    searchBtn: document.getElementById('searchBtn'),
    
    currentMajorName: document.getElementById('currentMajorName'),
    currentClassName: document.getElementById('currentClassName'),
    majorTrigger: document.getElementById('majorTrigger'),
    classTrigger: document.getElementById('classTrigger'),

    tabWeekly: document.getElementById('tabWeekly'),
    tabTotal: document.getElementById('tabTotal'),
    currentWeekBtn: document.getElementById('currentWeekBtn'),
    weekScrollerWrap: document.getElementById('weekScrollerWrap'),
    weekScrollList: document.getElementById('weekScrollList'),

    timetableGrid: document.getElementById('timetableGrid'),
    otherCoursesSection: document.getElementById('otherCoursesSection'),
    otherCoursesList: document.getElementById('otherCoursesList'),

    // Drawers & Search Popover
    majorDrawer: document.getElementById('majorDrawer'),
    majorSearchInput: document.getElementById('majorSearchInput'),
    majorPickerList: document.getElementById('majorPickerList'),

    classDrawer: document.getElementById('classDrawer'),
    classDrawerTitle: document.getElementById('classDrawerTitle'),
    classPickerList: document.getElementById('classPickerList'),

    searchPopover: document.getElementById('searchPopover'),
    searchBackdrop: document.getElementById('searchBackdrop'),
    globalSearchInput: document.getElementById('globalSearchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    searchResultsList: document.getElementById('searchResultsList'),

    detailDrawer: document.getElementById('detailDrawer'),
    detailCourseName: document.getElementById('detailCourseName'),
    detailTags: document.getElementById('detailTags'),
    detailTeacher: document.getElementById('detailTeacher'),
    detailLocation: document.getElementById('detailLocation'),
    detailCampus: document.getElementById('detailCampus'),
    detailWeeks: document.getElementById('detailWeeks'),
    detailSections: document.getElementById('detailSections'),
    detailCreditHours: document.getElementById('detailCreditHours'),
    detailCode: document.getElementById('detailCode'),

    toastMsg: document.getElementById('toastMsg')
  };

  // Initialize App
  function init() {
    setupTheme();
    setupInitialData();
    renderWeekSelectorChips();
    bindEvents();
    updateViewModeUI();
    renderTimetable();
  }

  // Theme Setup
  function setupTheme() {
    if (state.theme === 'dark') {
      elements.body.setAttribute('data-theme', 'dark');
      elements.themeToggleBtn.textContent = '☀️';
    } else {
      elements.body.removeAttribute('data-theme');
      elements.themeToggleBtn.textContent = '🌙';
    }
  }

  // Load Default Major/Class
  function setupInitialData() {
    if (!data || data.length === 0) return;

    let targetMajor = data[0];
    let targetClass = targetMajor.classes[0];

    state.currentMajor = targetMajor;
    state.currentClass = targetClass;

    updateSelectorHeaderUI();
  }

  // Update Selector Bar Text
  function updateSelectorHeaderUI() {
    if (state.currentMajor) {
      elements.currentMajorName.textContent = state.currentMajor.major;
    }
    if (state.currentClass) {
      elements.currentClassName.textContent = `${state.currentClass.class_name} (${state.currentClass.class_num})`;
    }
  }

  // Render 1~20 Week Chips
  function renderWeekSelectorChips() {
    elements.weekScrollList.innerHTML = '';
    for (let w = 1; w <= 20; w++) {
      const chip = document.createElement('div');
      chip.className = `week-chip ${w === state.currentWeek ? 'active' : ''}`;
      chip.textContent = `第${w}周`;
      chip.dataset.week = w;
      chip.addEventListener('click', () => {
        state.currentWeek = w;
        updateWeekChipsUI();
        renderTimetable();
      });
      elements.weekScrollList.appendChild(chip);
    }
  }

  function updateWeekChipsUI() {
    const chips = elements.weekScrollList.querySelectorAll('.week-chip');
    chips.forEach(chip => {
      const w = parseInt(chip.dataset.week, 10);
      if (w === state.currentWeek) {
        chip.classList.add('active');
        chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        chip.classList.remove('active');
      }
    });
  }

  // Update View Mode UI (Weekly vs Total)
  function updateViewModeUI() {
    if (state.viewMode === 'total') {
      elements.tabTotal.classList.add('active');
      elements.tabWeekly.classList.remove('active');
      elements.weekScrollerWrap.style.display = 'none';
    } else {
      elements.tabWeekly.classList.add('active');
      elements.tabTotal.classList.remove('active');
      elements.weekScrollerWrap.style.display = 'flex';
    }
  }

  // Render Main Timetable Grid
  function renderTimetable() {
    if (!state.currentClass) return;

    elements.timetableGrid.innerHTML = '';

    // 1. Render Period Label Column (Sections 1..12)
    const periodCol = document.createElement('div');
    periodCol.className = 'period-col';
    for (let s = 1; s <= 12; s++) {
      const slot = document.createElement('div');
      slot.className = 'time-slot-label';
      slot.innerHTML = `
        <span class="time-slot-num">${s}</span>
        <span class="time-slot-time">${TIME_SLOTS[s] || ''}</span>
      `;
      periodCol.appendChild(slot);
    }
    elements.timetableGrid.appendChild(periodCol);

    // 2. Render 7 Day Columns
    const courses = state.currentClass.courses || [];

    for (let d = 1; d <= 7; d++) {
      const dayCol = document.createElement('div');
      dayCol.className = 'day-column';
      dayCol.dataset.day = d;

      for (let s = 1; s <= 12; s++) {
        const ph = document.createElement('div');
        ph.className = 'grid-cell-placeholder';
        dayCol.appendChild(ph);
      }

      const dayCourses = courses.filter(c => c.day === d);

      dayCourses.forEach(c => {
        const isActiveInWeek = c.weeks.includes(state.currentWeek);

        // In Weekly mode, skip courses not in currentWeek
        if (state.viewMode === 'weekly' && !isActiveInWeek) {
          return;
        }

        const card = document.createElement('div');
        const themeClass = getCourseThemeClass(c.name);
        
        // In Total mode, all courses are active and bright
        card.className = `course-card ${themeClass}`;

        const startSec = Math.max(1, Math.min(12, c.start_section));
        const endSec = Math.max(startSec, Math.min(12, c.end_section));
        const span = endSec - startSec + 1;

        const topPx = (startSec - 1) * 62;
        const heightPx = span * 62 - 4;

        card.style.top = `${topPx}px`;
        card.style.height = `${heightPx}px`;

        card.innerHTML = `
          <div class="course-name">${c.name}</div>
          <div class="course-meta">
            ${c.location ? '📍' + c.location : (c.teacher ? '👤' + c.teacher : c.sections_raw)}
          </div>
        `;

        card.addEventListener('click', (e) => {
          e.stopPropagation();
          openCourseDetailDrawer(c);
        });

        dayCol.appendChild(card);
      });

      elements.timetableGrid.appendChild(dayCol);
    }

    // 3. Render Other Courses
    const otherCourses = state.currentClass.other_courses || [];
    if (otherCourses.length > 0) {
      elements.otherCoursesSection.style.display = 'block';
      elements.otherCoursesList.innerHTML = otherCourses.map(oc => `
        <div class="other-course-item">🔹 ${oc}</div>
      `).join('');
    } else {
      elements.otherCoursesSection.style.display = 'none';
    }
  }

  // Drawers Handlers
  function openDrawer(drawerEl) {
    drawerEl.classList.add('active');
  }

  function closeAllDrawers() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
    closeSearchPopover();
  }

  // Top Search Popover Logic
  function toggleSearchPopover() {
    const isShowing = elements.searchPopover.classList.contains('active');
    if (isShowing) {
      closeSearchPopover();
    } else {
      openSearchPopover();
    }
  }

  function openSearchPopover() {
    elements.searchPopover.classList.add('active');
    elements.searchBackdrop.classList.add('active');
    elements.searchBtn.classList.add('active');
    elements.globalSearchInput.value = '';
    elements.searchClearBtn.style.display = 'none';
    elements.searchResultsList.innerHTML = '<div style="text-align:center; padding:16px 10px; color:var(--text-muted); font-size:12px;">输入课程、教师或教室搜索全校课表</div>';
    setTimeout(() => elements.globalSearchInput.focus(), 100);
  }

  function closeSearchPopover() {
    elements.searchPopover.classList.remove('active');
    elements.searchBackdrop.classList.remove('active');
    elements.searchBtn.classList.remove('active');
  }

  function handleGlobalSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      elements.searchClearBtn.style.display = 'none';
      elements.searchResultsList.innerHTML = '<div style="text-align:center; padding:16px 10px; color:var(--text-muted); font-size:12px;">输入课程、教师或教室搜索全校课表</div>';
      return;
    }

    elements.searchClearBtn.style.display = 'flex';

    const results = [];
    data.forEach(m => {
      m.classes.forEach(c => {
        c.courses.forEach(crs => {
          if (
            crs.name.toLowerCase().includes(q) ||
            crs.teacher.toLowerCase().includes(q) ||
            crs.location.toLowerCase().includes(q) ||
            crs.campus.toLowerCase().includes(q)
          ) {
            results.push({ major: m, classObj: c, course: crs });
          }
        });
      });
    });

    if (results.length === 0) {
      elements.searchResultsList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">未检索到匹配的课程/教师/教室</div>';
      return;
    }

    elements.searchResultsList.innerHTML = '';
    results.slice(0, 25).forEach(res => {
      const item = document.createElement('div');
      item.className = 'picker-item';
      item.style.padding = '10px 12px';
      item.innerHTML = `
        <div>
          <div class="picker-item-name" style="font-size:13px;">${res.course.name}</div>
          <div class="picker-item-sub" style="font-size:11px;">教师: ${res.course.teacher || '未定'} | 场地: ${res.course.location || '未定'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px; font-weight:600; color:var(--primary-color);">${res.classObj.class_name}</div>
          <div class="picker-item-sub" style="font-size:10px;">${res.course.day_name} ${res.course.sections_raw}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        state.currentMajor = res.major;
        state.currentClass = res.classObj;
        updateSelectorHeaderUI();
        renderTimetable();
        closeSearchPopover();
        openCourseDetailDrawer(res.course);
      });
      elements.searchResultsList.appendChild(item);
    });
  }

  // Open Major Picker Drawer
  function openMajorPicker() {
    closeSearchPopover();
    renderMajorList(data);
    openDrawer(elements.majorDrawer);
    elements.majorSearchInput.value = '';
    elements.majorSearchInput.focus();
  }

  function renderMajorList(list) {
    elements.majorPickerList.innerHTML = '';
    list.forEach(m => {
      const item = document.createElement('div');
      item.className = 'picker-item';
      item.innerHTML = `
        <span class="picker-item-name">${m.major}</span>
        <span class="picker-item-sub">${m.class_count}个班级</span>
      `;
      item.addEventListener('click', () => {
        state.currentMajor = m;
        state.currentClass = m.classes[0];
        updateSelectorHeaderUI();
        renderTimetable();
        closeAllDrawers();
      });
      elements.majorPickerList.appendChild(item);
    });
  }

  // Open Class Picker Drawer
  function openClassPicker() {
    if (!state.currentMajor) return;
    closeSearchPopover();
    elements.classDrawerTitle.textContent = `${state.currentMajor.major} - 选择班级`;
    elements.classPickerList.innerHTML = '';

    state.currentMajor.classes.forEach(c => {
      const item = document.createElement('div');
      item.className = 'picker-item';
      item.innerHTML = `
        <span class="picker-item-name">${c.full_title}</span>
        <span class="picker-item-sub">${c.courses ? c.courses.length : 0}门课程</span>
      `;
      item.addEventListener('click', () => {
        state.currentClass = c;
        updateSelectorHeaderUI();
        renderTimetable();
        closeAllDrawers();
      });
      elements.classPickerList.appendChild(item);
    });

    openDrawer(elements.classDrawer);
  }

  // Open Course Detail Drawer
  function openCourseDetailDrawer(c) {
    elements.detailCourseName.textContent = c.name;
    
    elements.detailTags.innerHTML = `
      <span class="detail-tag">${c.day_name} ${c.sections_raw}</span>
      <span class="detail-tag">${c.weeks_raw}</span>
      ${c.campus ? `<span class="detail-tag">${c.campus}</span>` : ''}
    `;

    elements.detailTeacher.textContent = c.teacher || '未指定';
    elements.detailLocation.textContent = c.location || '未排地点';
    elements.detailCampus.textContent = c.campus || '通榆/新长校区';
    elements.detailWeeks.textContent = c.weeks_raw || '全学期';
    elements.detailSections.textContent = `${c.sections_raw} (第${c.start_section}-${c.end_section}节)`;
    elements.detailCreditHours.textContent = `${c.credit ? c.credit + ' 学分' : ''} ${c.hours ? '/ ' + c.hours + ' 学时' : ''}`.trim() || '未填';
    elements.detailCode.textContent = c.code || '普通教学班';

    openDrawer(elements.detailDrawer);
  }

  // Event Listeners Binding
  function bindEvents() {
    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('ys_theme', state.theme);
      setupTheme();
    });

    // Triggers
    elements.majorTrigger.addEventListener('click', openMajorPicker);
    elements.classTrigger.addEventListener('click', openClassPicker);
    
    // Top Search Popover Trigger
    elements.searchBtn.addEventListener('click', toggleSearchPopover);
    elements.searchBackdrop.addEventListener('click', closeSearchPopover);
    
    elements.searchClearBtn.addEventListener('click', () => {
      elements.globalSearchInput.value = '';
      handleGlobalSearch('');
      elements.globalSearchInput.focus();
    });

    // View Mode Tabs Switch
    elements.tabWeekly.addEventListener('click', () => {
      state.viewMode = 'weekly';
      updateViewModeUI();
      renderTimetable();
    });

    elements.tabTotal.addEventListener('click', () => {
      state.viewMode = 'total';
      updateViewModeUI();
      renderTimetable();
    });

    // "回到本周" button
    elements.currentWeekBtn.addEventListener('click', () => {
      state.currentWeek = getCalculatedAcademicWeek();
      updateWeekChipsUI();
      renderTimetable();
    });

    // Search Inputs
    elements.majorSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        renderMajorList(data);
      } else {
        const filtered = data.filter(m => m.major.toLowerCase().includes(q));
        renderMajorList(filtered);
      }
    });

    elements.globalSearchInput.addEventListener('input', (e) => {
      handleGlobalSearch(e.target.value);
    });

    // Close Drawers
    document.querySelectorAll('.closeDrawerBtn').forEach(btn => {
      btn.addEventListener('click', closeAllDrawers);
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeAllDrawers();
        }
      });
    });
  }

  // Run on DOM Content Loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
