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
    return 1; // Default to 1st week
  }

  let state = {
    currentMajor: null,
    currentClass: null,
    currentWeek: getCalculatedAcademicWeek(),
    viewMode: 'weekly' // 'weekly' or 'total'
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
    
    currentMajorName: document.getElementById('currentMajorName'),
    currentClassName: document.getElementById('currentClassName'),
    majorTrigger: document.getElementById('majorTrigger'),
    classTrigger: document.getElementById('classTrigger'),

    tabWeekly: document.getElementById('tabWeekly'),
    tabTotal: document.getElementById('tabTotal'),
    weekScrollerWrap: document.getElementById('weekScrollerWrap'),
    weekScrollList: document.getElementById('weekScrollList'),

    timetableGrid: document.getElementById('timetableGrid'),
    otherCoursesSection: document.getElementById('otherCoursesSection'),
    otherCoursesList: document.getElementById('otherCoursesList'),

    // Drawers
    majorDrawer: document.getElementById('majorDrawer'),
    majorSearchInput: document.getElementById('majorSearchInput'),
    majorPickerList: document.getElementById('majorPickerList'),

    classDrawer: document.getElementById('classDrawer'),
    classDrawerTitle: document.getElementById('classDrawerTitle'),
    classPickerList: document.getElementById('classPickerList'),

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
    setupInitialData();
    renderWeekSelectorChips();
    bindEvents();
    updateViewModeUI();
    renderTimetable();
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
        card.dataset.name = c.name;
        card.dataset.day = c.day;
        card.dataset.startSection = c.start_section;

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

  // Toast Message Handler
  function showToast(msg) {
    if (!elements.toastMsg) return;
    elements.toastMsg.textContent = msg;
    elements.toastMsg.classList.add('show');
    setTimeout(() => {
      elements.toastMsg.classList.remove('show');
    }, 2200);
  }

  // Drawers Handlers
  function openDrawer(drawerEl) {
    drawerEl.classList.add('active');
  }

  function closeAllDrawers() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
  }

  // Open Major Picker Drawer
  function openMajorPicker() {
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
        showToast(`已切换至 ${m.major} (${m.classes[0].class_name})`);
      });
      elements.majorPickerList.appendChild(item);
    });
  }

  // Open Class Picker Drawer
  function openClassPicker() {
    if (!state.currentMajor) return;
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
        showToast(`已切换至 ${c.class_name}`);
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
    // Triggers
    elements.majorTrigger.addEventListener('click', openMajorPicker);
    elements.classTrigger.addEventListener('click', openClassPicker);

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

    // Search Input inside Major Drawer
    elements.majorSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        renderMajorList(data);
      } else {
        const cleanQ = q.replace(/\s+/g, '');
        const filtered = data.filter(m => (m.major || '').toLowerCase().replace(/\s+/g, '').includes(cleanQ));
        renderMajorList(filtered);
      }
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
