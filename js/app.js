/**
 * Mini App entry: Telegram SDK, auth, simple routing and UI.
 */
(function () {
  var profile = null;
  var currentScreen = 'home';
  var lastOpenedResumesList = [];
  var lastVacanciesList = [];
  var lastVacanciesAppliedIds = {};
  var lastMyVacanciesList = [];
  var lastPendingApprovalList = [];
  var lastAllCandidatesList = [];

  function showLoading(msg) {
    var el = document.getElementById('app-content');
    if (!el) return;
    el.innerHTML = '<div class="loading">' + (msg || 'Loading...') + '</div>';
  }

  function showError(msg, err) {
    var el = document.getElementById('app-content');
    if (!el) return;
    var detail = '';
    if (err) {
      if (err.status) detail += ' Код: ' + err.status + '.';
      if (err.data) {
        if (typeof err.data === 'object' && err.data.message) detail += ' ' + err.data.message;
        else if (typeof err.data === 'string') detail += ' ' + err.data.substring(0, 200);
        else detail += ' ' + JSON.stringify(err.data).substring(0, 200);
      }
    }
    el.innerHTML = '<div class="error">' + escapeHtml(msg || 'Something went wrong.') +
      (detail ? '<p class="error-detail">' + escapeHtml(detail) + '</p>' : '') +
      '<button type="button" class="btn-secondary" id="error-retry">Повторить</button> ' +
      '<button type="button" class="btn-back" data-screen="home">На главную</button></div>';
    var btn = document.getElementById('error-retry');
    if (btn) btn.addEventListener('click', function () { location.reload(); });
  }

  function getAppMode() {
    try {
      return localStorage.getItem('hr_app_mode') || '';
    } catch (e) { return ''; }
  }
  function setAppMode(mode) {
    try { localStorage.setItem('hr_app_mode', mode); } catch (e) {}
  }

  function renderModeChoice() {
    var html = '<div class="screen screen-mode-choice">';
    html += '<h1 class="screen-title mode-choice-title">What do you want to do?</h1>';
    html += '<p class="mode-choice-hint">Choose one option. You can change it later in Profile.</p>';
    html += '<div class="mode-choice-cards">';
    html += '<button type="button" class="mode-choice-card" data-mode="candidate">';
    html += '<span class="mode-choice-icon">👤</span>';
    html += '<span class="mode-choice-label">I\'m looking for a job</span>';
    html += '<span class="mode-choice-desc">Vacancies, my resume, applications, matches</span>';
    html += '</button>';
    html += '<button type="button" class="mode-choice-card" data-mode="employer">';
    html += '<span class="mode-choice-icon">🏢</span>';
    html += '<span class="mode-choice-label">I want to post a vacancy</span>';
    html += '<span class="mode-choice-desc">My vacancies, create vacancy, opened resumes</span>';
    html += '</button>';
    html += '</div></div>';
    return html;
  }

  function renderHome() {
    var mode = getAppMode();
    if (!mode) {
      return renderModeChoice();
    }
    var name = 'User';
    if (profile) {
      var fn = (profile.first_name || '').trim();
      var ln = (profile.last_name || '').trim();
      name = (fn + ' ' + ln).trim() || (profile.display_name || '').trim() || profile.username || 'User';
    }
    var html = '<div class="screen home">';
    html += '<div class="welcome-card">';
    html += '<p class="greeting">Welcome back</p>';
    html += '<p class="user-name">' + escapeHtml(name) + '</p>';
    html += '<span class="role-badge">' + escapeHtml(mode === 'employer' ? 'Employer' : 'Job seeker') + '</span>';
    html += '</div>';
    html += '<div class="nav-cards">';
    if (mode === 'candidate') {
      html += '<button type="button" class="nav-card" data-screen="vacancies"><span>Vacancies</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="resume"><span>My resume</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="applications"><span>My applications</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="matches"><span>My matches</span><span class="arrow">›</span></button>';
    } else {
      html += '<button type="button" class="nav-card" data-screen="my-vacancies"><span>My vacancies</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="create-vacancy"><span>Create vacancy</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="all-candidates"><span>All candidates</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="pending-approval"><span>Pending my approval</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="opened-resumes"><span>Opened resumes</span><span class="arrow">›</span></button>';
    }
    html += '<p class="section-label">Account</p>';
    html += '<button type="button" class="nav-card" data-screen="profile"><span>Profile</span><span class="arrow">›</span></button>';
    html += '<button type="button" class="nav-card" data-screen="debug"><span>Диагностика бэкенда</span><span class="arrow">›</span></button>';
    html += '<p class="app-build">HR Ecosystem · Build 2024.02.24</p>';
    html += '</div></div>';
    return html;
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderProfile() {
    var p = profile || {};
    var name = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || (p.display_name || '').trim() || p.user_login || '—';
    var nameEmpty = !name || name === '—';
    if (nameEmpty) name = 'Имя не указано';
    var mode = getAppMode();
    var roleLabel = (p.role === 'employer' ? 'Employer' : (p.role === 'admin' ? 'Admin' : (p.role === 'candidate' ? 'Candidate' : (p.role || '—'))));
    var html = '<div class="screen profile">';
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Profile</h1></div>';
    html += '<div class="profile-card">';
    html += '<div class="field"><div class="field-label">Name</div><div class="field-value">' + escapeHtml(name) + '</div></div>';
    if (nameEmpty) html += '<p class="profile-hint">Выйдите и зайдите снова из Telegram — имя подтянется из профиля.</p>';
    html += '<div class="field"><div class="field-label">Role</div><div class="field-value">' + escapeHtml(roleLabel) + '</div></div>';
    html += '<div class="field"><div class="field-label">Current mode</div><div class="field-value">' + escapeHtml(mode === 'employer' ? 'Posting vacancies' : 'Looking for job') + '</div></div>';
    html += '<div class="field"><div class="field-label">Status</div><div class="field-value">' + escapeHtml(p.hr_status || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">Skills</div><div class="field-value">' + escapeHtml(p.hr_skills || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">Tags</div><div class="field-value">' + escapeHtml(p.hr_tags || '—') + '</div></div>';
    html += '</div>';
    html += '<p class="section-label">Switch mode</p>';
    html += '<button type="button" class="nav-card" id="profile-mode-candidate">Looking for a job</button>';
    html += '<button type="button" class="nav-card" id="profile-mode-employer">Posting vacancies</button>';
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function ensureArray(val) {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object' && Array.isArray(val.items)) return val.items;
    if (val && typeof val === 'object' && Array.isArray(val.data)) return val.data;
    if (val && typeof val === 'object' && Array.isArray(val.list)) return val.list;
    if (val && typeof val === 'object' && Array.isArray(val.vacancies)) return val.vacancies;
    if (val && typeof val === 'object') {
      var k = Object.keys(val)[0];
      if (k && Array.isArray(val[k])) return val[k];
    }
    return [];
  }

  function renderList(title, items, itemLabel) {
    items = ensureArray(items);
    itemLabel = itemLabel || function (x) { return x.title || x.vacancy_title || x.id; };
    var html = '<div class="screen list">';
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">' + escapeHtml(title) + '</h1></div>';
    if (!items || items.length === 0) {
      html += '<div class="empty-state">No items yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      items.forEach(function (item) {
        html += '<li>' + escapeHtml(typeof itemLabel === 'function' ? itemLabel(item) : item[itemLabel]) + '</li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderResumeView(r) {
    r = r || {};
    var firstName = r.first_name || (profile && profile.first_name) || '';
    var lastName = r.last_name || (profile && profile.last_name) || '';
    var fullName = (firstName + ' ' + lastName).trim() || '—';
    var html = '<div class="screen" id="resume-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">My resume</h1></div>';
    html += '<div class="content-card">';
    html += '<div class="field"><div class="field-label">Name</div><div class="field-value">' + escapeHtml(fullName) + '</div></div>';
    html += '<div class="field"><div class="field-label">Title</div><div class="field-value">' + escapeHtml(r.title || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">About</div><div class="content-body">' + escapeHtml(r.content || '') + '</div></div>';
    if (r.cv_url) html += '<a href="' + escapeHtml(r.cv_url) + '" target="_blank" class="link-cv">Download CV</a>';
    html += '</div>';
    html += '<button type="button" class="btn-primary" id="resume-edit-btn">Edit resume</button>';
    html += ' <button type="button" class="btn-danger" id="resume-delete-btn">Delete resume</button>';
    html += ' <button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderResumeForm(r) {
    r = r || {};
    var backScreen = r.id ? 'resume' : 'home';
    var html = '<div class="screen" id="resume-form-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="' + backScreen + '">‹</button><h1 class="screen-title">' + (r.id ? 'Edit resume' : 'Create resume') + '</h1></div>';
    html += '<div class="form-card">';
    html += '<label class="field-label">First name</label><input type="text" id="resume-first-name" value="' + escapeHtml(r.first_name || (profile && profile.first_name) || '') + '" placeholder="First name" />';
    html += '<label class="field-label">Last name</label><input type="text" id="resume-last-name" value="' + escapeHtml(r.last_name || (profile && profile.last_name) || '') + '" placeholder="Last name" />';
    html += '<label class="field-label">Title</label><input type="text" id="resume-title" value="' + escapeHtml(r.title || '') + '" placeholder="e.g. Senior Developer" />';
    html += '<label class="field-label">About you (text)</label><textarea id="resume-content" rows="6" placeholder="Experience, skills...">' + escapeHtml(r.content || '') + '</textarea>';
    html += '<label class="field-label">Attach CV (PDF, DOC)</label><input type="file" id="resume-cv-file" accept=".pdf,.doc,.docx" class="input-file" />';
    if (r.cv_url) html += '<p class="hint">Current file: <a href="' + escapeHtml(r.cv_url) + '" target="_blank">Download CV</a></p>';
    html += '<button type="button" class="btn-secondary" id="resume-ai-btn">Generate with AI</button>';
    html += '<button type="button" class="btn-primary" id="resume-save-btn">Save</button></div></div>';
    return html;
  }

  function renderVacanciesWithRespond(vacancies, appliedIds) {
    vacancies = ensureArray(vacancies);
    appliedIds = appliedIds || {};
    var html = '<div class="screen" id="vacancies-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Vacancies</h1></div>';
    if (!vacancies || vacancies.length === 0) {
      html += '<div class="empty-state">No vacancies yet.</div>';
      html += '<p class="vacancies-hint">Если вы создали вакансию в админке WordPress — привяжите её к категории <strong>Public</strong> или включите <strong>Club badge</strong> в профиле пользователя.</p>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      vacancies.forEach(function (v, i) {
        var applied = appliedIds[v.id];
        html += '<li class="list-item-with-action"><div class="item-main">' + escapeHtml(v.title || '') + '</div>';
        html += '<div class="item-actions"><button type="button" class="btn-sm btn-outline" data-view-vacancy="' + i + '">View</button>';
        if (applied) {
          html += '<span class="badge-applied">Applied</span>';
        } else {
          html += '<button type="button" class="btn-sm btn-primary" data-respond-vacancy="' + v.id + '">Respond</button>';
        }
        html += '</div></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderMyVacanciesList(list) {
    list = ensureArray(list);
    var html = '<div class="screen" id="my-vacancies-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">My vacancies</h1></div>';
    if (!list || list.length === 0) {
      html += '<div class="empty-state">No vacancies yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      list.forEach(function (v, i) {
        var sub = (v.company_name ? v.company_name + ' · ' : '') + (v.title || '');
        html += '<li class="list-item-with-action"><div class="item-main"><span class="item-title">' + escapeHtml(v.title || '') + '</span>' + (v.company_name ? '<span class="item-meta">' + escapeHtml(v.company_name) + '</span>' : '') + '</div>';
        html += '<div class="item-actions"><button type="button" class="btn-sm btn-outline" data-view-my-vacancy="' + i + '">View</button>';
        html += '<button type="button" class="btn-sm btn-danger" data-delete-my-vacancy="' + v.id + '">Delete</button></div></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderVacancyDetail(v, applied, isMine, backScreen) {
    backScreen = backScreen || 'vacancies';
    var html = '<div class="screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="' + escapeHtml(backScreen) + '">‹</button><h1 class="screen-title">Vacancy</h1></div>';
    html += '<div class="content-card vacancy-detail">';
    if (v.company_name) html += '<p class="vacancy-company">' + escapeHtml(v.company_name) + '</p>';
    html += '<h2 class="vacancy-detail-title">' + escapeHtml(v.title || '') + '</h2>';
    if (v.skills_required) html += '<p class="vacancy-meta"><strong>Skills:</strong> ' + escapeHtml(v.skills_required) + '</p>';
    if (v.tags) html += '<p class="vacancy-meta"><strong>Tags:</strong> ' + escapeHtml(v.tags) + '</p>';
    var content = (v.content || v.excerpt || '').trim();
    html += '<div class="vacancy-content content-body">' + (content ? content : escapeHtml('')) + '</div>';
    html += '</div>';
    if (isMine) {
      html += '<button type="button" class="btn-danger btn-full" id="vacancy-detail-delete-btn" data-vacancy-id="' + (v.id || '') + '">Delete vacancy</button>';
    } else if (applied) {
      html += '<span class="badge-applied badge-inline">You applied</span>';
    } else {
      html += '<button type="button" class="btn-primary btn-full" id="vacancy-detail-respond-btn" data-vacancy-id="' + (v.id || '') + '">Respond</button>';
    }
    html += '<button type="button" class="btn-back" data-screen="' + escapeHtml(backScreen) + '">Back to list</button></div>';
    return html;
  }

  function renderMatchesWithReaction(matches) {
    matches = ensureArray(matches);
    var html = '<div class="screen" id="matches-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">My matches</h1></div>';
    if (!matches || matches.length === 0) {
      html += '<div class="empty-state">No matches yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      matches.forEach(function (m) {
        html += '<li class="list-item-match"><div class="item-main">' + escapeHtml(m.vacancy_title || '') + ' — ' + escapeHtml(m.status || '') + '</div>';
        html += '<div class="match-actions"><button type="button" class="btn-sm btn-reaction' + (m.reaction === 'interested' ? ' active' : '') + '" data-match-id="' + m.id + '" data-reaction="interested">Interested</button>';
        html += ' <button type="button" class="btn-sm btn-reaction' + (m.reaction === 'not_interested' ? ' active' : '') + '" data-match-id="' + m.id + '" data-reaction="not_interested">Not interested</button></div></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderOpenedResumesList(list) {
    list = ensureArray(list);
    var html = '<div class="screen" id="opened-resumes-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Opened resumes</h1></div>';
    if (!list || list.length === 0) {
      html += '<div class="empty-state">No opened resumes yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      list.forEach(function (x, i) {
        var label = (x.vacancy_company_name ? x.vacancy_company_name + ' · ' : '') + (x.vacancy_title || '') + ' — ' + (x.candidate_name || '');
        html += '<li class="list-item-with-action"><div class="item-main">' + escapeHtml(label) + '</div>';
        html += '<button type="button" class="btn-sm btn-primary" data-opened-index="' + i + '">View</button></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderPendingApprovalList(list) {
    list = ensureArray(list);
    var html = '<div class="screen" id="pending-approval-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Pending my approval</h1></div>';
    if (!list || list.length === 0) {
      html += '<div class="empty-state">No matches waiting for your approval.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      list.forEach(function (x, i) {
        var label = (x.vacancy_company_name ? x.vacancy_company_name + ' · ' : '') + (x.vacancy_title || '') + ' — ' + (x.candidate_name || '');
        html += '<li class="list-item-with-action"><div class="item-main">' + escapeHtml(label) + '</div>';
        html += '<div class="item-actions"><button type="button" class="btn-sm btn-outline" data-pending-view="' + i + '">View</button>';
        html += '<button type="button" class="btn-sm btn-primary" data-pending-approve="' + x.match_id + '">Approve</button>';
        html += '<button type="button" class="btn-sm btn-danger" data-pending-reject="' + x.match_id + '">Reject</button></div></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderPendingApprovalDetail(item) {
    var html = '<div class="screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="pending-approval">‹</button><h1 class="screen-title">Candidate</h1></div>';
    html += '<div class="content-card"><p class="content-meta">' + escapeHtml(item.vacancy_company_name || '') + ' · ' + escapeHtml(item.vacancy_title || '') + ' — ' + escapeHtml(item.candidate_name || '') + '</p>';
    if (item.resume && (item.resume.title || item.resume.content || item.resume.cv_url)) {
      if (item.resume.title) html += '<p class="content-title">' + escapeHtml(item.resume.title) + '</p>';
      if (item.resume.content) html += '<div class="content-body">' + escapeHtml(item.resume.content) + '</div>';
      if (item.resume.cv_url) html += '<a href="' + escapeHtml(item.resume.cv_url) + '" target="_blank" class="link-cv">Download CV</a>';
    }
    if (item.candidate_skills || item.candidate_tags) {
      html += '<div class="candidate-profile">';
      if (item.candidate_skills) html += '<p class="profile-line"><strong>Skills:</strong> ' + escapeHtml(item.candidate_skills) + '</p>';
      if (item.candidate_tags) html += '<p class="profile-line"><strong>Tags:</strong> ' + escapeHtml(item.candidate_tags) + '</p>';
      html += '</div>';
    }
    html += '</div>';
    html += '<button type="button" class="btn-primary" data-pending-approve="' + item.match_id + '">Approve match</button> ';
    html += '<button type="button" class="btn-danger" data-pending-reject="' + item.match_id + '">Reject</button>';
    html += '<button type="button" class="btn-back" data-screen="pending-approval">Back to list</button></div>';
    return html;
  }

  function renderOpenedResumeDetail(item) {
    var vacancyTitle = item.vacancy_title || '';
    var candidateName = item.candidate_name || '';
    var resume = item.resume;
    var skills = item.candidate_skills || '';
    var tags = item.candidate_tags || '';
    var status = item.candidate_status || '';
    var html = '<div class="screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="opened-resumes">‹</button><h1 class="screen-title">Candidate</h1></div>';
    html += '<div class="content-card"><p class="content-meta">' + escapeHtml(vacancyTitle) + ' · ' + escapeHtml(candidateName) + '</p>';
    if (resume && (resume.title || resume.content || resume.cv_url)) {
      if (resume.title) html += '<p class="content-title">' + escapeHtml(resume.title) + '</p>';
      if (resume.content) html += '<div class="content-body">' + escapeHtml(resume.content) + '</div>';
      if (resume.cv_url) html += '<a href="' + escapeHtml(resume.cv_url) + '" target="_blank" class="link-cv">Download CV</a>';
    }
    if (skills || tags || status) {
      html += '<div class="candidate-profile">';
      if (status) html += '<p class="profile-line"><strong>Status:</strong> ' + escapeHtml(status) + '</p>';
      if (skills) html += '<p class="profile-line"><strong>Skills:</strong> ' + escapeHtml(skills) + '</p>';
      if (tags) html += '<p class="profile-line"><strong>Tags:</strong> ' + escapeHtml(tags) + '</p>';
      html += '</div>';
    }
    if (!resume && !skills && !tags && !status) {
      html += '<p class="empty-state">No resume or profile data yet.</p>';
    }
    html += '</div><button type="button" class="btn-back" data-screen="opened-resumes">Back to list</button></div>';
    return html;
  }

  function renderAllCandidatesList(list) {
    list = ensureArray(list);
    var html = '<div class="screen" id="all-candidates-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">All candidates</h1></div>';
    if (!list || list.length === 0) {
      html += '<div class="empty-state">No candidates with resumes yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      list.forEach(function (x, i) {
        var label = (x.candidate_name || '') + ' — ' + (x.resume && x.resume.title ? x.resume.title : 'Resume');
        html += '<li class="list-item-with-action"><div class="item-main">' + escapeHtml(label) + '</div>';
        html += '<button type="button" class="btn-sm btn-outline" data-all-candidates-view="' + i + '">View</button></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderCandidateDetail(item) {
    var resume = item.resume;
    var skills = item.candidate_skills || '';
    var tags = item.candidate_tags || '';
    var status = item.candidate_status || '';
    var html = '<div class="screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="all-candidates">‹</button><h1 class="screen-title">Candidate</h1></div>';
    html += '<div class="content-card"><p class="content-meta">' + escapeHtml(item.candidate_name || '') + '</p>';
    if (resume && (resume.title || resume.content || resume.cv_url)) {
      if (resume.title) html += '<p class="content-title">' + escapeHtml(resume.title) + '</p>';
      if (resume.content) html += '<div class="content-body">' + escapeHtml(resume.content) + '</div>';
      if (resume.cv_url) html += '<a href="' + escapeHtml(resume.cv_url) + '" target="_blank" class="link-cv">Download CV</a>';
    }
    if (skills || tags || status) {
      html += '<div class="candidate-profile">';
      if (status) html += '<p class="profile-line"><strong>Status:</strong> ' + escapeHtml(status) + '</p>';
      if (skills) html += '<p class="profile-line"><strong>Skills:</strong> ' + escapeHtml(skills) + '</p>';
      if (tags) html += '<p class="profile-line"><strong>Tags:</strong> ' + escapeHtml(tags) + '</p>';
      html += '</div>';
    }
    html += '</div><button type="button" class="btn-back" data-screen="all-candidates">Back to list</button></div>';
    return html;
  }

  function renderCreateVacancyForm() {
    var html = '<div class="screen" id="create-vacancy-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Create vacancy</h1></div>';
    html += '<div class="form-card"><label class="field-label">Company name</label><input type="text" id="vacancy-company" placeholder="Your company or brand" />';
    html += '<label class="field-label">Job title (who you are looking for) *</label><input type="text" id="vacancy-title" placeholder="e.g. Frontend Developer" />';
    html += '<label class="field-label">Description</label><textarea id="vacancy-content" rows="5" placeholder="Requirements, responsibilities..."></textarea>';
    html += '<label class="field-label">Required skills</label><input type="text" id="vacancy-skills" placeholder="e.g. PHP, React" />';
    html += '<label class="field-label">Tags</label><input type="text" id="vacancy-tags" placeholder="e.g. remote, full-time" />';
    html += '<button type="button" class="btn-secondary" id="vacancy-ai-btn">Generate description with AI</button>';
    html += '<button type="button" class="btn-primary" id="vacancy-submit-btn">Publish</button></div></div>';
    return html;
  }

  function setContent(html) {
    var el = document.getElementById('app-content');
    if (el) el.innerHTML = html;
    var buttons = el ? el.querySelectorAll('[data-screen]') : [];
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        goTo(this.getAttribute('data-screen'));
      });
    });
    if (el) {
      el.querySelectorAll('.mode-choice-card').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var m = this.getAttribute('data-mode');
          if (m) {
            setAppMode(m);
            goTo(m === 'candidate' ? 'resume' : 'create-vacancy');
          }
        });
      });
    }
    var pmCandidate = document.getElementById('profile-mode-candidate');
    if (pmCandidate) pmCandidate.onclick = function () { setAppMode('candidate'); goTo('home'); };
    var pmEmployer = document.getElementById('profile-mode-employer');
    if (pmEmployer) pmEmployer.onclick = function () { setAppMode('employer'); goTo('home'); };
    bindCustomActions();
  }

  function bindCustomActions() {
    var el = document.getElementById('app-content');
    if (!el) return;
    var role = (profile && profile.role) || 'candidate';

    var editBtn = document.getElementById('resume-edit-btn');
    if (editBtn) {
      editBtn.onclick = function () {
        window.HR_API.get('/resumes/me').then(function (r) {
          var resumeData = (r && r.resume !== undefined) ? r.resume : r;
          setContent(renderResumeForm(resumeData || {}));
        }).catch(function () {
          setContent(renderResumeForm({}));
        });
      };
    }
    var resumeDeleteBtn = document.getElementById('resume-delete-btn');
    if (resumeDeleteBtn) {
      resumeDeleteBtn.onclick = function () {
        if (!confirm('Delete your resume? This cannot be undone.')) return;
        resumeDeleteBtn.disabled = true;
        window.HR_API.delete('/resumes/me').then(function () {
          goTo('resume');
        }).catch(function (e) {
          resumeDeleteBtn.disabled = false;
          alert(e.message || 'Failed to delete');
        });
      };
    }

    var saveBtn = document.getElementById('resume-save-btn');
    if (saveBtn) {
      saveBtn.onclick = function () {
        var titleEl = document.getElementById('resume-title');
        var contentEl = document.getElementById('resume-content');
        var firstNameEl = document.getElementById('resume-first-name');
        var lastNameEl = document.getElementById('resume-last-name');
        var title = (titleEl && titleEl.value) || '';
        var content = (contentEl && contentEl.value) || '';
        var firstName = (firstNameEl && firstNameEl.value) || '';
        var lastName = (lastNameEl && lastNameEl.value) || '';
        var fileInput = document.getElementById('resume-cv-file');
        var file = fileInput && fileInput.files && fileInput.files[0];
        saveBtn.disabled = true;
        var payload = { title: title, content: content, cv_attachment_id: 0 };
        if (firstName !== undefined) payload.first_name = firstName;
        if (lastName !== undefined) payload.last_name = lastName;
        var doSave = function (cvId) {
          payload.cv_attachment_id = cvId || 0;
          window.HR_API.post('/resumes/me', payload).then(function (r) {
            var resumeData = (r && r.resume !== undefined) ? r.resume : r;
            setContent(renderResumeView(resumeData || r || {}));
          }).catch(function (e) {
            saveBtn.disabled = false;
            alert(e.message || 'Failed to save');
          });
        };
        if (file) {
          window.HR_API.uploadMedia(file).then(function (media) {
            doSave(media.id);
          }).catch(function (e) {
            saveBtn.disabled = false;
            alert(e.message || 'Upload failed');
          });
        } else {
          doSave(0);
        }
      };
    }

    var resumeAiBtn = document.getElementById('resume-ai-btn');
    if (resumeAiBtn) {
      resumeAiBtn.onclick = function () {
        var contentEl = document.getElementById('resume-content');
        var titleEl = document.getElementById('resume-title');
        var prompt = (contentEl && contentEl.value) || (titleEl && titleEl.value) || '';
        if (!prompt.trim()) {
          alert('Enter a title or short description, then click Generate with AI.');
          return;
        }
        resumeAiBtn.disabled = true;
        resumeAiBtn.textContent = 'Generating...';
        window.HR_API.generateResume(prompt).then(function (data) {
          if (data && data.title && titleEl) titleEl.value = data.title;
          if (data && data.content && contentEl) contentEl.value = data.content;
          resumeAiBtn.disabled = false;
          resumeAiBtn.textContent = 'Generate with AI';
        }).catch(function (e) {
          resumeAiBtn.disabled = false;
          resumeAiBtn.textContent = 'Generate with AI';
          var msg = e.message || 'AI generation failed.';
          if (e.status === 404 || (msg && (msg.indexOf('маршрут') !== -1 || msg.indexOf('route') !== -1 || msg.indexOf('not found') !== -1)))
            msg = 'Функция AI пока недоступна: обновите плагин на WordPress (должны быть маршруты /ai/generate-resume и OpenAI API Key в настройках).';
          alert(msg);
        });
      };
    }

    el.querySelectorAll('[data-view-vacancy]').forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(this.getAttribute('data-view-vacancy'), 10);
        var v = lastVacanciesList[i];
        if (v) setContent(renderVacancyDetail(v, lastVacanciesAppliedIds[v.id], false, 'vacancies'));
      };
    });

    el.querySelectorAll('[data-respond-vacancy]').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-respond-vacancy');
        if (!id) return;
        this.disabled = true;
        window.HR_API.post('/vacancies/' + id + '/respond', {}).then(function () {
          goTo('vacancies');
        }).catch(function (e) {
          btn.disabled = false;
          alert(e.message || 'Failed');
        });
      };
    });

    var detailRespondBtn = document.getElementById('vacancy-detail-respond-btn');
    if (detailRespondBtn) {
      detailRespondBtn.onclick = function () {
        var id = this.getAttribute('data-vacancy-id');
        if (!id) return;
        this.disabled = true;
        window.HR_API.post('/vacancies/' + id + '/respond', {}).then(function () {
          lastVacanciesAppliedIds[id] = true;
          goTo('vacancies');
        }).catch(function (e) {
          detailRespondBtn.disabled = false;
          alert(e.message || 'Failed');
        });
      };
    }
    var detailDeleteBtn = document.getElementById('vacancy-detail-delete-btn');
    if (detailDeleteBtn) {
      detailDeleteBtn.onclick = function () {
        var id = this.getAttribute('data-vacancy-id');
        if (!id || !confirm('Delete this vacancy? This cannot be undone.')) return;
        detailDeleteBtn.disabled = true;
        window.HR_API.delete('/vacancies/' + id).then(function () {
          goTo('my-vacancies');
        }).catch(function (e) {
          detailDeleteBtn.disabled = false;
          alert(e.message || 'Failed to delete');
        });
      };
    }
    el.querySelectorAll('[data-view-my-vacancy]').forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(this.getAttribute('data-view-my-vacancy'), 10);
        var v = lastMyVacanciesList[i];
        if (v) setContent(renderVacancyDetail(v, false, true, 'my-vacancies'));
      };
    });
    el.querySelectorAll('[data-delete-my-vacancy]').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-delete-my-vacancy');
        if (!id || !confirm('Delete this vacancy? This cannot be undone.')) return;
        var elBtn = this;
        elBtn.disabled = true;
        window.HR_API.delete('/vacancies/' + id).then(function () {
          goTo('my-vacancies');
        }).catch(function (e) {
          elBtn.disabled = false;
          alert(e.message || 'Failed to delete');
        });
      };
    });
    el.querySelectorAll('[data-pending-view]').forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(this.getAttribute('data-pending-view'), 10);
        var item = lastPendingApprovalList[i];
        if (item) setContent(renderPendingApprovalDetail(item));
      };
    });
    el.querySelectorAll('[data-pending-approve]').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-pending-approve');
        if (!id) return;
        this.disabled = true;
        window.HR_API.patch('/matches/' + id, { status: 'confirmed' }).then(function () {
          goTo('pending-approval');
        }).catch(function (e) {
          btn.disabled = false;
          alert(e.message || 'Failed');
        });
      };
    });
    el.querySelectorAll('[data-pending-reject]').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-pending-reject');
        if (!id || !confirm('Reject this match?')) return;
        this.disabled = true;
        window.HR_API.patch('/matches/' + id, { status: 'rejected' }).then(function () {
          goTo('pending-approval');
        }).catch(function (e) {
          btn.disabled = false;
          alert(e.message || 'Failed');
        });
      };
    });
    el.querySelectorAll('[data-all-candidates-view]').forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(this.getAttribute('data-all-candidates-view'), 10);
        var item = lastAllCandidatesList[i];
        if (item) setContent(renderCandidateDetail(item));
      };
    });

    el.querySelectorAll('.btn-reaction').forEach(function (btn) {
      btn.onclick = function () {
        var matchId = this.getAttribute('data-match-id');
        var reaction = this.getAttribute('data-reaction');
        if (!matchId) return;
        window.HR_API.patch('/matches/' + matchId + '/reaction', { reaction: reaction }).then(function () {
          goTo('matches');
        }).catch(function (e) {
          alert(e.message || 'Failed');
        });
      };
    });

    el.querySelectorAll('[data-opened-index]').forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(this.getAttribute('data-opened-index'), 10);
        var item = lastOpenedResumesList[i];
        if (item) setContent(renderOpenedResumeDetail(item));
      };
    });

    var vacancySubmit = document.getElementById('vacancy-submit-btn');
    if (vacancySubmit) {
      vacancySubmit.onclick = function () {
        var title = (document.getElementById('vacancy-title') && document.getElementById('vacancy-title').value) || '';
        if (!title.trim()) {
          alert('Job title is required');
          return;
        }
        var company = (document.getElementById('vacancy-company') && document.getElementById('vacancy-company').value) || '';
        var content = (document.getElementById('vacancy-content') && document.getElementById('vacancy-content').value) || '';
        var skills = (document.getElementById('vacancy-skills') && document.getElementById('vacancy-skills').value) || '';
        var tags = (document.getElementById('vacancy-tags') && document.getElementById('vacancy-tags').value) || '';
        vacancySubmit.disabled = true;
        window.HR_API.post('/vacancies', { title: title.trim(), content: content, skills_required: skills, tags: tags, company_name: company.trim() }).then(function () {
          goTo('my-vacancies');
        }).catch(function (e) {
          vacancySubmit.disabled = false;
          alert(e.message || 'Failed to create');
        });
      };
    }

    var vacancyAiBtn = document.getElementById('vacancy-ai-btn');
    if (vacancyAiBtn) {
      vacancyAiBtn.onclick = function () {
        var contentEl = document.getElementById('vacancy-content');
        var rawText = (contentEl && contentEl.value) || '';
        if (!rawText.trim()) {
          alert('Paste the raw job description text into the Description field, then click Generate description with AI.');
          return;
        }
        vacancyAiBtn.disabled = true;
        vacancyAiBtn.textContent = 'Processing...';
        window.HR_API.parseVacancyWithAi(rawText).then(function (data) {
          var titleEl = document.getElementById('vacancy-title');
          var skillsEl = document.getElementById('vacancy-skills');
          var tagsEl = document.getElementById('vacancy-tags');
          if (data && data.title && titleEl) titleEl.value = data.title;
          if (data && data.content && contentEl) contentEl.value = data.content || data.excerpt || '';
          if (data && data.skills_required && skillsEl) skillsEl.value = data.skills_required;
          if (data && data.tags && tagsEl) tagsEl.value = data.tags;
          vacancyAiBtn.disabled = false;
          vacancyAiBtn.textContent = 'Generate description with AI';
        }).catch(function (e) {
          vacancyAiBtn.disabled = false;
          vacancyAiBtn.textContent = 'Generate description with AI';
          var msg = e.message || 'AI parsing failed.';
          if (e.status === 404 || (msg && (msg.indexOf('маршрут') !== -1 || msg.indexOf('route') !== -1 || msg.indexOf('not found') !== -1)))
            msg = 'Функция AI пока недоступна: обновите плагин на WordPress (маршруты /ai/parse-vacancy и OpenAI API Key в настройках).';
          alert(msg);
        });
      };
    }
  }

  function goTo(screen) {
    currentScreen = screen;
    showLoading();
    if (screen === 'home') {
      window.HR_API.get('/me').then(function (me) {
        profile = me;
        setContent(renderHome());
      }).catch(function () {
        setContent(renderHome());
      });
      return;
    }
    if (screen === 'profile') {
      window.HR_API.get('/me').then(function (me) {
        profile = me;
        setContent(renderProfile());
      }).catch(function (e) {
        showError(e.message || 'Failed to load profile', e);
      });
      return;
    }
    if (screen === 'vacancies') {
      Promise.all([ window.HR_API.get('/vacancies'), window.HR_API.get('/applications/me') ]).then(function (arr) {
        var list = ensureArray(arr && arr[0] !== undefined ? arr[0] : []);
        var applications = ensureArray(arr && arr[1] !== undefined ? arr[1] : []);
        var appliedIds = {};
        applications.forEach(function (a) { appliedIds[a.vacancy_id] = true; });
        lastVacanciesList = list;
        lastVacanciesAppliedIds = appliedIds;
        setContent(renderVacanciesWithRespond(list, appliedIds));
      }).catch(function (e) {
        showError(e.message || 'Failed to load vacancies', e);
      });
      return;
    }
    if (screen === 'my-vacancies') {
      window.HR_API.get('/vacancies/me').then(function (raw) {
        lastMyVacanciesList = ensureArray(raw);
        setContent(renderMyVacanciesList(lastMyVacanciesList));
      }).catch(function (e) {
        showError(e.message || 'Failed to load', e);
      });
      return;
    }
    if (screen === 'resume') {
      window.HR_API.get('/resumes/me').then(function (r) {
        var resumeData = null;
        if (r && typeof r === 'object') {
          if (r.resume !== undefined) resumeData = r.resume;
          else if (r.id || r.title || r.content) resumeData = r;
        }
        if (resumeData && resumeData !== null && (resumeData.id || resumeData.title || resumeData.content)) {
          setContent(renderResumeView(resumeData));
        } else {
          setContent(renderResumeForm({}));
        }
      }).catch(function (e) {
        var msg = (e.message || 'Не удалось загрузить резюме.') + ' Проверьте интернет и попробуйте снова.';
        var html = '<div class="screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">My resume</h1></div>';
        html += '<div class="error">' + escapeHtml(msg) + '</div>';
        html += '<button type="button" class="btn-back" data-screen="resume">Повторить</button>';
        html += ' <button type="button" class="btn-back" data-screen="home">На главную</button></div>';
        setContent(html);
      });
      return;
    }
    if (screen === 'applications') {
      window.HR_API.get('/applications/me').then(function (raw) {
        var list = ensureArray(raw);
        setContent(renderList('My applications', list, function (a) { return (a.vacancy_title || a.vacancy_id) + ' — ' + (a.status || ''); }));
      }).catch(function (e) {
        showError(e.message || 'Failed to load', e);
      });
      return;
    }
    if (screen === 'matches') {
      window.HR_API.get('/matches/me').then(function (raw) {
        var list = ensureArray(raw);
        setContent(renderMatchesWithReaction(list));
      }).catch(function (e) {
        showError(e.message || 'Failed to load', e);
      });
      return;
    }
    if (screen === 'opened-resumes') {
      window.HR_API.get('/resumes/opened').then(function (raw) {
        lastOpenedResumesList = ensureArray(raw);
        setContent(renderOpenedResumesList(lastOpenedResumesList));
      }).catch(function (e) {
        showError(e.message || 'Failed to load', e);
      });
      return;
    }
    if (screen === 'pending-approval') {
      window.HR_API.get('/matches/pending-approval').then(function (raw) {
        lastPendingApprovalList = ensureArray(raw);
        setContent(renderPendingApprovalList(lastPendingApprovalList));
      }).catch(function (e) {
        showError(e.message || 'Failed to load', e);
      });
      return;
    }
    if (screen === 'all-candidates') {
      window.HR_API.get('/candidates').then(function (raw) {
        lastAllCandidatesList = ensureArray(raw);
        setContent(renderAllCandidatesList(lastAllCandidatesList));
      }).catch(function (e) {
        showError(e.message || 'Failed to load', e);
      });
      return;
    }
    if (screen === 'create-vacancy') {
      setContent(renderCreateVacancyForm());
      return;
    }
    if (screen === 'debug') {
      var debugUrl = (window.HR_API.getBase && window.HR_API.getBase()) || (window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL) || '';
      if (debugUrl && typeof debugUrl === 'string') {
        debugUrl = debugUrl.replace(/\/$/, '') + (debugUrl.indexOf('/wp-json') !== -1 ? '' : '/wp-json/hr/v1') + '/debug';
      } else {
        debugUrl = '?';
      }
      var tokenSent = !!(window.HR_API.getToken && window.HR_API.getToken());
      window.HR_API.get('/debug').then(function (data) {
        var html = '<div class="screen debug"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Диагностика бэкенда</h1></div>';
        html += '<div class="profile-card">';
        html += '<div class="field"><div class="field-label">URL запроса</div><div class="field-value debug-url">' + escapeHtml(debugUrl) + '</div></div>';
        html += '<div class="field"><div class="field-label">Токен в приложении</div><div class="field-value">' + (tokenSent ? 'Да, отправлен' : 'Нет — бэк не узнает вас') + '</div></div>';
        html += '<p class="debug-message">' + escapeHtml(data.message || '') + '</p>';
        html += '<div class="field"><div class="field-label">user_id</div><div class="field-value">' + (data.user_id != null ? data.user_id : '—') + '</div></div>';
        html += '<div class="field"><div class="field-label">Вакансий на бэке</div><div class="field-value">' + (data.vacancies_count != null ? data.vacancies_count : '—') + '</div></div>';
        html += '<div class="field"><div class="field-label">ID резюме</div><div class="field-value">' + (data.resume_id != null ? data.resume_id : '—') + '</div></div>';
        if (data.profile && typeof data.profile === 'object') {
          html += '<p class="section-label">Профиль с бэка</p><pre class="debug-json">' + escapeHtml(JSON.stringify(data.profile, null, 2)) + '</pre>';
        }
        html += '<p class="section-label">Полный ответ сервера (как пришёл)</p><pre class="debug-json">' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre>';
        html += '</div><button type="button" class="btn-back" data-screen="home">Назад</button></div>';
        setContent(html);
      }).catch(function (e) {
        showError('Не удалось получить ответ от бэкенда. Проверьте URL в config.js и что плагин обновлён.', e);
      });
      return;
    }
    setContent(renderHome());
  }

  function renderDevLogin() {
    var base = (window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL) || window.location.origin;
    var url = base.replace(/\/$/, '') + '/wp-json/hr/v1/dev-token';
    var html = '<div class="screen dev-login">';
    html += '<h1 class="screen-title">Dev mode</h1>';
    html += '<p class="hint">Get a token from WordPress (admin): open site in same browser, run in console:</p>';
    html += '<pre class="code">fetch("' + escapeHtml(url) + '", { credentials: "include", headers: { "X-WP-Nonce": wpApiSettings.nonce } }).then(r=>r.json()).then(d=>alert(d.token))</pre>';
    html += '<p class="hint">Paste the token below or open with <code>?dev=1&token=YOUR_TOKEN</code></p>';
    html += '<input type="text" id="dev-token-input" placeholder="Paste token" />';
    html += '<button type="button" id="dev-token-submit">Use token</button>';
    html += '</div>';
    return html;
  }

  function init() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg) {
      document.body.classList.add('tg-webapp');
      tg.ready();
      tg.expand();
    }
    try {
      var saved = window.localStorage.getItem('hr_token');
      if (saved && window.HR_API && window.HR_API.setToken) window.HR_API.setToken(saved);
    } catch (e) {}
    showLoading('Logging in...');
    window.HR_AUTH.ensureAuth()
      .then(function (me) {
        profile = me || profile;
        goTo('home');
      })
      .catch(function (e) {
        var msg = e.message || 'Auth failed. Open this app from Telegram.';
        if (e.data && e.data.message) msg = e.data.message;
        var inTelegram = window.HR_AUTH.getTelegramInitData && window.HR_AUTH.getTelegramInitData();
        if (!inTelegram) {
          setContent(renderDevLogin());
          var btn = document.getElementById('dev-token-submit');
          var input = document.getElementById('dev-token-input');
          if (btn && input) {
            btn.addEventListener('click', function () {
              var token = (input.value || '').trim();
              if (!token) return;
              window.HR_AUTH.setDevToken(token);
              window.HR_API.setToken(token);
              showLoading('Checking token...');
              window.HR_API.get('/me').then(function (me) {
                profile = me;
                goTo('home');
              }).catch(function () {
                window.HR_API.setToken(null);
                window.HR_AUTH.setDevToken(null);
                setContent(renderDevLogin());
                alert('Invalid or expired token.');
              });
            });
          }
          return;
        }
        showError(msg, e);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
