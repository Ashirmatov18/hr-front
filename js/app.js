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
  var lastMatchesList = [];
  var vacanciesStatusFilter = 'open';
  var myVacanciesStatusFilter = '';
  var emailLinkStep = 'start';
  var emailLinkAddress = '';
  var customUiButtons = [];

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
    if (profile && (profile.role === 'employer' || profile.role === 'admin')) return 'employer';
    return 'candidate';
  }

  function normalizeMembershipStatus(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function normalizeMembershipLevel(value) {
    var raw = (value || '').toString().trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'platinum' || raw.indexOf('platinum') !== -1) return 'platinum';
    if (raw === 'gold' || raw.indexOf('gold') !== -1) return 'gold';
    if (raw === 'silver' || raw.indexOf('silver') !== -1) return 'silver';
    return '';
  }

  function isClubVerified(p) {
    p = p || {};
    var status = normalizeMembershipStatus(p.club_membership_status);
    var level = normalizeMembershipLevel(p.club_member_level);
    var badge = !!p.club_badge;
    if (status === 'verified') return true;
    if (badge) return true;
    if (level === 'silver' || level === 'gold' || level === 'platinum') return true;
    return false;
  }

  function getClubMembershipLabel(p) {
    p = p || {};
    var status = normalizeMembershipStatus(p.club_membership_status);
    var level = normalizeMembershipLevel(p.club_member_level);
    if (!isClubVerified(p)) return 'Unverified member';
    if (level === 'silver') return 'Silver subscription';
    if (level === 'gold') return 'Gold subscription';
    if (level === 'platinum') return 'Platinum subscription';
    if (status === 'verified') return 'Verified member';
    return 'Verified member';
  }

  function renderHome() {
    var name = 'User';
    if (profile) {
      var fn = (profile.first_name || '').trim();
      var ln = (profile.last_name || '').trim();
      name = (fn + ' ' + ln).trim() || (profile.display_name || '').trim() || profile.username || 'User';
    }
    var role = (profile && profile.role) || 'candidate';
    var clubVerified = isClubVerified(profile);
    var clubLabel = getClubMembershipLabel(profile || {});
    var html = '<div class="screen home">';
    html += '<div class="welcome-card">';
    html += '<p class="greeting">Welcome back</p>';
    html += '<p class="user-name">' + escapeHtml(name) + '</p>';
    html += '<div class="welcome-badges">';
    html += '<span class="role-badge ' + (clubVerified ? 'role-badge-verified' : 'role-badge-unverified') + '">' + escapeHtml(clubLabel) + '</span>';
    html += '</div>';
    if ((role === 'employer' || role === 'admin') && profile && profile.employer_type) {
      var employerTypeLabels = { independent_hr: 'Independent HR', recruitment_agency: 'Recruitment agency', direct_employer: 'Direct employer', other: 'Other', startup: 'Startup', smb: 'SMB', enterprise: 'Enterprise' };
      var etLabel = employerTypeLabels[profile.employer_type] || profile.employer_type;
      html += '<p class="welcome-company-type">Company type: ' + escapeHtml(etLabel) + '</p>';
    }
    html += '</div>';
    html += '<div class="nav-cards">';
    html += '<button type="button" class="nav-card" data-screen="profile"><span>Profile</span><span class="arrow">›</span></button>';
    html += '<button type="button" class="nav-card" data-screen="club-services"><span>HR</span><span class="arrow">›</span></button>';
    html += '<button type="button" class="nav-card" data-screen="instruction"><span>' + escapeHtml(((window.HR_CONFIG && window.HR_CONFIG.INSTRUCTION_TITLE) ? window.HR_CONFIG.INSTRUCTION_TITLE : 'Instruction')) + '</span><span class="arrow">›</span></button>';
    if (role === 'admin') {
      html += '<button type="button" class="nav-card" data-screen="vip-check"><span>VIP check (test)</span><span class="arrow">›</span></button>';
    }
    var webAppUrl = (window.HR_CONFIG && window.HR_CONFIG.WEB_APP_URL) ? (window.HR_CONFIG.WEB_APP_URL + '').trim() : '';
    if (webAppUrl && typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
      html += '<button type="button" class="nav-card" id="nav-web-version"><span>Web version</span><span class="arrow">›</span></button>';
    }
    var appTitle = (window.HR_CONFIG && window.HR_CONFIG.APP_TITLE) ? (window.HR_CONFIG.APP_TITLE + '').trim() : 'HR Ecosystem';
    var appBuild = (window.HR_CONFIG && window.HR_CONFIG.APP_BUILD) ? (window.HR_CONFIG.APP_BUILD + '').trim() : '2024.02.24';
    html += '<p class="app-build">' + escapeHtml(appTitle) + ' · Build ' + escapeHtml(appBuild) + '</p>';
    html += '</div></div>';
    return html;
  }

  function renderInstruction() {
    var title = (window.HR_CONFIG && window.HR_CONFIG.INSTRUCTION_TITLE) ? (window.HR_CONFIG.INSTRUCTION_TITLE + '').trim() : 'Instruction';
    var text = (window.HR_CONFIG && window.HR_CONFIG.INSTRUCTION_TEXT) ? (window.HR_CONFIG.INSTRUCTION_TEXT + '') : '';
    var html = '<div class="screen instruction">';
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">' + escapeHtml(title) + '</h1></div>';
    html += '<div class="profile-card">';
    if (text && text.trim()) {
      html += '<div class="content-body">' + escapeHtml(text).replace(/\n/g, '<br>') + '</div>';
    } else {
      html += '<div class="content-body">Текст инструкции пока не задан. Его можно заполнить в <code>mini-app/js/config.js</code> (поле <code>INSTRUCTION_TEXT</code>).</div>';
    }
    html += '</div>';
    html += '<button type="button" class="btn-back" data-screen="home">Back</button>';
    html += '</div>';
    return html;
  }

  function renderTelegramEntryScreen() {
    var html = '<div class="screen auth-choice">';
    html += '<div class="form-card">';
    html += '<h1 class="screen-title">Welcome</h1>';
    html += '<p class="hint">Choose how you want to enter HR.</p>';
    html += '<button type="button" class="btn-primary btn-full" id="telegram-login-btn">Continue with Telegram</button>';
    html += '<button type="button" class="btn-secondary btn-full" id="existing-member-btn">I am already a club member</button>';
    html += '</div></div>';
    return html;
  }

  function renderExistingMemberScreen() {
    var html = '<div class="screen auth-choice">';
    html += '<div class="screen-header"><button type="button" class="back-btn" id="existing-member-back">‹</button><h1 class="screen-title">Existing member</h1></div>';
    html += '<div class="form-card">';
    html += '<p class="hint">Enter the email you used in the club system. We will send a short verification code and then link your Telegram account to this profile.</p>';
    html += '<label class="field-label">Email</label>';
    html += '<input type="email" id="existing-member-email" value="' + escapeHtml(emailLinkAddress || '') + '" placeholder="name@example.com" ' + (emailLinkStep === 'confirm' ? 'readonly' : '') + ' />';
    if (emailLinkStep === 'confirm') {
      html += '<p class="hint">If this email exists in the club database, the verification code was sent. Check your inbox and enter the code below.</p>';
      html += '<label class="field-label">Verification code</label>';
      html += '<input type="text" id="existing-member-code" inputmode="numeric" maxlength="6" placeholder="6-digit code" />';
      html += '<button type="button" class="btn-primary btn-full" id="existing-member-confirm-btn">Confirm and link Telegram</button>';
      html += '<button type="button" class="btn-secondary btn-full" id="existing-member-resend-btn">Send code again</button>';
    } else {
      html += '<button type="button" class="btn-primary btn-full" id="existing-member-send-btn">Send verification code</button>';
    }
    html += '</div></div>';
    return html;
  }

  function renderVipCheckScreen() {
    var html = '<div class="screen vip-check">';
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">VIP check</h1></div>';
    html += '<div class="form-card">';
    html += '<p class="hint">Enter email to check VIP status from configured club table.</p>';
    html += '<label class="field-label">Email</label>';
    html += '<input type="email" id="vip-check-email" placeholder="name@example.com" />';
    html += '<button type="button" class="btn-primary btn-full" id="vip-check-submit">Check VIP status</button>';
    html += '<div id="vip-check-result" class="content-meta" style="margin-top:10px;">—</div>';
    html += '</div></div>';
    return html;
  }

  function renderClubServices(stats, counts, customButtons) {
    counts = counts || {};
    customButtons = ensureArray(customButtons);
    var isEmployer = (profile && (profile.role === 'employer' || profile.role === 'admin'));
    var unread = (counts.unread_messages | 0) || 0;
    var pendingApproval = (counts.pending_approval_count | 0) || 0;
    var applicationsToMy = (counts.applications_to_my_vacancies | 0) || 0;
    var generalButtons = customButtons.filter(function (x) {
      return x && x.group === 'general' && x.label && x.type && x.value;
    });
    var employerButtons = customButtons.filter(function (x) {
      return x && x.group === 'employer' && x.label && x.type && x.value;
    });
    function badge(n) { return n > 0 ? '<span class="nav-badge">' + (n > 99 ? '99+' : n) + '</span>' : ''; }
    function addNavCard(label, attrs, isFirst) {
      var classes = 'nav-card' + (isFirst ? ' nav-card-first' : '');
      return '<button type="button" class="' + classes + '" ' + attrs + '><span>' + escapeHtml(label) + '</span><span class="arrow">›</span></button>';
    }
    var html = '<div class="screen club-services">';
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">HR</h1></div>';
    html += '<details class="hr-service-block" open>';
    var appTitle = (window.HR_CONFIG && window.HR_CONFIG.APP_TITLE) ? (window.HR_CONFIG.APP_TITLE + '').trim() : '';
    html += '<summary class="hr-service-summary">' + escapeHtml(appTitle || 'HR Service CFO Club') + '</summary>';
    if (stats && typeof stats.total_candidates === 'number') {
      html += '<div class="club-stats">';
      html += '<span class="club-stat"><strong>' + stats.total_candidates + '</strong> candidates</span>';
      html += ' <span class="club-stat"><strong>' + stats.total_vacancies + '</strong> vacancies</span>';
      html += ' <span class="club-stat"><strong>' + stats.closed_vacancies + '</strong> closed</span>';
      html += '</div>';
    }
    html += '<div class="nav-cards">';
    var publicUrl = (window.HR_CONFIG && window.HR_CONFIG.PUBLIC_CHAT_URL) ? (window.HR_CONFIG.PUBLIC_CHAT_URL + '').trim() : '';
    var clubUrl = (window.HR_CONFIG && window.HR_CONFIG.CLUB_MEMBER_URL) ? (window.HR_CONFIG.CLUB_MEMBER_URL + '').trim() : '';
    var hasAnyCard = false;
    if (publicUrl) {
      html += addNavCard('Apply to public chat', 'data-external-url="' + escapeHtml(publicUrl) + '"', !hasAnyCard);
      hasAnyCard = true;
    }
    if (clubUrl) {
      html += addNavCard('Apply to club member', 'data-external-url="' + escapeHtml(clubUrl) + '"', !hasAnyCard);
      hasAnyCard = true;
    }
    html += addNavCard('Open vacancies', 'data-screen="vacancies"', !hasAnyCard);
    hasAnyCard = true;
    html += addNavCard('Place candidacy', 'data-screen="resume"', !hasAnyCard);
    hasAnyCard = true;
    html += '<button type="button" class="nav-card" data-screen="matches"><span>My matches</span>' + badge(unread) + '<span class="arrow">›</span></button>';

    generalButtons.forEach(function (btn) {
      if (btn.type === 'url') {
        html += addNavCard(btn.label, 'data-external-url="' + escapeHtml(btn.value) + '"', !hasAnyCard);
      } else {
        html += addNavCard(btn.label, 'data-screen="' + escapeHtml(btn.value) + '"', !hasAnyCard);
      }
      hasAnyCard = true;
    });

    if (isEmployer) {
      html += '<p class="section-label">Employer</p>';
      html += '<button type="button" class="nav-card" data-screen="my-vacancies"><span>My vacancies</span>' + badge(applicationsToMy) + '<span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="create-vacancy"><span>Create vacancy</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="pending-approval"><span>Candidates</span>' + badge(pendingApproval) + '<span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="opened-resumes"><span>Opened resumes</span><span class="arrow">›</span></button>';
      employerButtons.forEach(function (btn) {
        if (btn.type === 'url') {
          html += addNavCard(btn.label, 'data-external-url="' + escapeHtml(btn.value) + '"', false);
        } else {
          html += addNavCard(btn.label, 'data-screen="' + escapeHtml(btn.value) + '"', false);
        }
      });
    }
    html += '</div></details>';
    html += '</div>';
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
    var roleLabel = (p.role === 'employer' ? 'Employer' : (p.role === 'admin' ? 'Admin' : 'Club member'));
    var clubVerified = isClubVerified(p);
    var clubLabel = getClubMembershipLabel(p);
    var linkedinDisplay = p.linkedin_skipped ? 'I don\'t have LinkedIn' : (p.linkedin_url ? p.linkedin_url : '—');
    var html = '<div class="screen profile">';
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Profile</h1></div>';
    html += '<div class="profile-card">';
    html += '<div class="field"><div class="field-label">Name</div><div class="field-value">' + escapeHtml(name) + '</div></div>';
    if (nameEmpty) html += '<p class="profile-hint">Выйдите и зайдите снова из Telegram — имя подтянется из профиля.</p>';
    html += '<div class="field"><div class="field-label">Role</div><div class="field-value">' + escapeHtml(roleLabel) + '</div></div>';
    html += '<div class="field"><div class="field-label">Club</div><div class="field-value"><span class="role-badge ' + (clubVerified ? 'role-badge-verified' : 'role-badge-unverified') + '">' + escapeHtml(clubLabel) + '</span></div></div>';
    if (p.role === 'employer' && p.employer_type) {
      var employerTypeLabels = { independent_hr: 'Independent HR', recruitment_agency: 'Recruitment agency', direct_employer: 'Direct employer', other: 'Other', startup: 'Startup', smb: 'SMB', enterprise: 'Enterprise' };
      var employerTypeLabel = employerTypeLabels[p.employer_type] || p.employer_type;
      html += '<div class="field"><div class="field-label">Employer type</div><div class="field-value">' + escapeHtml(employerTypeLabel) + '</div></div>';
    }
    html += '<div class="field"><div class="field-label">Status</div><div class="field-value">' + escapeHtml(p.hr_status || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">LinkedIn</div><div class="field-value">';
    if (p.linkedin_url) html += '<a href="' + escapeHtml(p.linkedin_url) + '" target="_blank" rel="noopener">' + escapeHtml(p.linkedin_url) + '</a>';
    else html += escapeHtml(linkedinDisplay);
    html += '</div></div>';
    html += '<div class="field"><div class="field-label">Skills</div><div class="field-value">' + escapeHtml(p.hr_skills || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">Tags</div><div class="field-value">' + escapeHtml(p.hr_tags || '—') + '</div></div>';
    html += '</div>';
    html += '<p class="section-label">Edit</p>';
    html += '<button type="button" class="nav-card" data-screen="profile-edit"><span>Edit profile</span><span class="arrow">›</span></button>';
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderOfferScreen() {
    var text = (profile && profile.offer_text) ? profile.offer_text : '';
    var html = '<div class="screen offer">';
    html += '<div class="screen-header"><h1 class="screen-title">User agreement</h1></div>';
    html += '<div class="profile-card offer-text">';
    html += '<div class="content-body">' + (text ? escapeHtml(text).replace(/\n/g, '<br>') : 'Please accept the terms to continue.') + '</div>';
    html += '</div>';
    html += '<label class="checkbox-label"><input type="checkbox" id="offer-accept-cb" /> I accept the terms</label>';
    html += '<button type="button" class="btn-primary btn-full" id="offer-accept-btn" disabled>Accept and continue</button>';
    html += '</div>';
    return html;
  }

  function renderLinkedInStepScreen() {
    var p = profile || {};
    var html = '<div class="screen" id="linkedin-step-screen">';
    html += '<div class="screen-header"><h1 class="screen-title">LinkedIn profile</h1></div>';
    html += '<div class="form-card">';
    html += '<p class="hint">Add your LinkedIn profile link, or skip if you don\'t use it.</p>';
    html += '<label class="field-label">LinkedIn profile URL</label>';
    html += '<input type="url" id="linkedin-step-url" value="' + escapeHtml(p.linkedin_url || '') + '" placeholder="https://linkedin.com/in/..." />';
    html += '<label class="checkbox-label" style="margin-top:10px;"><input type="checkbox" id="linkedin-step-skip" ' + (p.linkedin_skipped ? 'checked' : '') + ' /> I don\'t have LinkedIn</label>';
    html += '<button type="button" class="btn-primary btn-full" id="linkedin-step-continue">Continue</button>';
    html += '</div></div>';
    return html;
  }

  function renderProfileEdit() {
    var p = profile || {};
    var html = '<div class="screen profile-edit">';
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="profile">‹</button><h1 class="screen-title">Edit profile</h1></div>';
    html += '<div class="form-card">';
    html += '<label class="field-label">First name</label>';
    html += '<input type="text" id="profile-first-name" value="' + escapeHtml(p.first_name || '') + '" placeholder="First name" />';
    html += '<label class="field-label">Last name</label>';
    html += '<input type="text" id="profile-last-name" value="' + escapeHtml(p.last_name || '') + '" placeholder="Last name" />';
    html += '<label class="field-label">Skills</label>';
    html += '<input type="text" id="profile-skills" value="' + escapeHtml(p.hr_skills || '') + '" placeholder="e.g. PHP, JavaScript, project management" />';
    html += '<label class="field-label">Tags</label>';
    html += '<input type="text" id="profile-tags" value="' + escapeHtml(p.hr_tags || '') + '" placeholder="e.g. remote, startup, team lead" />';
    html += '<label class="field-label">LinkedIn profile URL</label>';
    html += '<input type="url" id="profile-linkedin-url" value="' + escapeHtml(p.linkedin_url || '') + '" placeholder="https://linkedin.com/in/..." />';
    html += '<label class="checkbox-label" style="margin-top:10px;"><input type="checkbox" id="profile-linkedin-skip" ' + (p.linkedin_skipped ? 'checked' : '') + ' /> I don\'t have LinkedIn</label>';
    html += '<p class="hint">You can leave the field empty or check the box if you don\'t use LinkedIn (e.g. due to regional restrictions).</p>';
    html += '<button type="button" class="btn-primary" id="profile-save-btn">Save</button>';
    html += '</div></div>';
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
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">' + escapeHtml(title) + '</h1></div>';
    if (!items || items.length === 0) {
      html += '<div class="empty-state">No items yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      items.forEach(function (item) {
        html += '<li>' + escapeHtml(typeof itemLabel === 'function' ? itemLabel(item) : item[itemLabel]) + '</li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="club-services">Back</button></div>';
    return html;
  }

  function renderResumeView(r) {
    r = r || {};
    var firstName = r.first_name || (profile && profile.first_name) || '';
    var lastName = r.last_name || (profile && profile.last_name) || '';
    var fullName = (firstName + ' ' + lastName).trim() || '—';
    var html = '<div class="screen" id="resume-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">My resume</h1></div>';
    html += '<div class="content-card">';
    html += '<div class="field"><div class="field-label">Name</div><div class="field-value">' + escapeHtml(fullName) + '</div></div>';
    html += '<div class="field"><div class="field-label">Title</div><div class="field-value">' + escapeHtml(r.title || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">About</div><div class="content-body">' + escapeHtml(r.content || '') + '</div></div>';
    html += '<div class="field"><div class="field-label">Attached files</div><div class="field-value">';
    if (r.cv_url) {
      html += '<a href="' + escapeHtml(r.cv_url) + '" target="_blank" rel="noopener" class="link-cv">📄 Download CV</a>';
    } else {
      html += '<span class="text-muted">No file attached</span>';
    }
    html += '</div></div>';
    html += '</div>';
    html += '<button type="button" class="btn-primary" id="resume-edit-btn">Edit resume</button>';
    html += ' <button type="button" class="btn-danger" id="resume-delete-btn">Delete resume</button>';
    html += ' <button type="button" class="btn-back" data-screen="club-services">Back</button></div>';
    return html;
  }

  function renderResumeForm(r) {
    r = r || {};
    var backScreen = r.id ? 'resume' : 'club-services';
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
    var html = '<div class="screen" id="vacancies-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">Vacancies</h1></div>';
    html += '<div class="form-card filter-card">';
    html += '<label class="field-label" for="vacancies-status-filter">Status</label>';
    html += '<div class="filter-group"><select id="vacancies-status-filter"><option value="open"' + (vacanciesStatusFilter === 'open' ? ' selected' : '') + '>Open</option><option value="closed"' + (vacanciesStatusFilter === 'closed' ? ' selected' : '') + '>Closed</option></select></div>';
    html += '</div>';
    if (!vacancies || vacancies.length === 0) {
      html += '<div class="empty-state">No vacancies yet.</div>';
      html += '<p class="vacancies-hint">Если вакансия создана в админ-панели — привяжите её к категории <strong>Public</strong> или включите <strong>Club badge</strong> в профиле пользователя.</p>';
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
    html += '<button type="button" class="btn-back" data-screen="club-services">Back</button></div>';
    return html;
  }

  function renderMyVacanciesList(list) {
    list = ensureArray(list);
    var html = '<div class="screen" id="my-vacancies-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">My vacancies</h1></div>';
    html += '<div class="form-card filter-card">';
    html += '<label class="field-label" for="my-vacancies-status-filter">Status</label>';
    html += '<div class="filter-group"><select id="my-vacancies-status-filter"><option value=""' + (myVacanciesStatusFilter === '' ? ' selected' : '') + '>All</option><option value="open"' + (myVacanciesStatusFilter === 'open' ? ' selected' : '') + '>Open</option><option value="closed"' + (myVacanciesStatusFilter === 'closed' ? ' selected' : '') + '>Closed</option></select></div>';
    html += '</div>';
    if (!list || list.length === 0) {
      html += '<div class="empty-state">No vacancies yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      list.forEach(function (v, i) {
        var isClosed = (v.status || '').toLowerCase() === 'closed';
        var modStatus = (v.moderation_status || '').toLowerCase();
        var statusClass = isClosed ? 'vacancy-status vacancy-status-closed' : 'vacancy-status vacancy-status-open';
        var statusLabel = isClosed ? 'Closed' : 'Open';
        var modLabel = modStatus === 'pending_review' ? 'Pending review' : (modStatus === 'rejected' ? 'Rejected' : (modStatus === 'published' ? 'Published' : ''));
        var modClass = modStatus === 'pending_review' ? 'moderation-status moderation-pending' : (modStatus === 'rejected' ? 'moderation-status moderation-rejected' : (modStatus === 'published' ? 'moderation-status moderation-published' : ''));
        var appCount = (v.applications_count | 0);
        var appLabel = appCount > 0 ? ' <span class="vacancy-app-count">' + appCount + ' response' + (appCount !== 1 ? 's' : '') + '</span>' : '';
        html += '<li class="list-item-with-action"><div class="item-main"><span class="item-title">' + escapeHtml(v.title || '') + '</span>' + (v.company_name ? '<span class="item-meta">' + escapeHtml(v.company_name) + '</span>' : '') + ' <span class="' + statusClass + '">' + escapeHtml(statusLabel) + '</span>' + (modLabel ? ' <span class="' + modClass + '">' + escapeHtml(modLabel) + '</span>' : '') + appLabel + '</div>';
        html += '<div class="item-actions"><button type="button" class="btn-sm btn-outline" data-view-my-vacancy="' + i + '">View</button>';
        if (!isClosed && modStatus === 'published') html += '<button type="button" class="btn-sm btn-close-vacancy" data-close-vacancy="' + v.id + '">Close</button>';
        html += '<button type="button" class="btn-sm btn-danger" data-delete-my-vacancy="' + v.id + '">Delete</button></div></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="club-services">Back</button></div>';
    return html;
  }

  function renderVacancyDetail(v, applied, isMine, backScreen) {
    backScreen = backScreen || 'vacancies';
    var isClosed = isMine && ((v.status || '').toLowerCase() === 'closed');
    var modStatus = isMine ? (v.moderation_status || '').toLowerCase() : '';
    var canClose = isMine && !isClosed && modStatus === 'published';
    var html = '<div class="screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="' + escapeHtml(backScreen) + '">‹</button><h1 class="screen-title">Vacancy</h1></div>';
    html += '<div class="content-card vacancy-detail">';
    if (isMine && (v.status || v.moderation_status)) {
      html += '<p class="vacancy-status-line">';
      if (v.status) html += '<span class="vacancy-status ' + (isClosed ? 'vacancy-status-closed' : 'vacancy-status-open') + '">' + escapeHtml(isClosed ? 'Closed' : 'Open') + '</span> ';
      if (modStatus === 'pending_review') html += '<span class="moderation-status moderation-pending">Pending review</span>';
      else if (modStatus === 'rejected') html += '<span class="moderation-status moderation-rejected">Rejected</span>';
      else if (modStatus === 'published') html += '<span class="moderation-status moderation-published">Published</span>';
      html += '</p>';
    }
    if (v.company_name) html += '<p class="vacancy-company">' + escapeHtml(v.company_name) + '</p>';
    html += '<h2 class="vacancy-detail-title">' + escapeHtml(v.title || '') + '</h2>';
    if (v.skills_required) html += '<p class="vacancy-meta"><strong>Skills:</strong> ' + escapeHtml(v.skills_required) + '</p>';
    if (v.tags) html += '<p class="vacancy-meta"><strong>Tags:</strong> ' + escapeHtml(v.tags) + '</p>';
    var content = (v.content || v.excerpt || '').trim();
    html += '<div class="vacancy-content content-body">' + (content ? content : escapeHtml('')) + '</div>';
    html += '</div>';
    if (isMine) {
      if (canClose) html += '<button type="button" class="btn-close-vacancy btn-full" id="vacancy-detail-close-btn" data-vacancy-id="' + (v.id || '') + '">Close vacancy</button>';
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
    var isEmployer = (profile && (profile.role === 'employer' || profile.role === 'admin'));
    var html = '<div class="screen" id="matches-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">My matches</h1></div>';
    if (!matches || matches.length === 0) {
      html += '<div class="empty-state">No matches yet.</div>';
    } else if (isEmployer) {
      html += '<div class="list-card"><ul class="list-items">';
      matches.forEach(function (m, i) {
        var chatTitle = (m.vacancy_title || '') + (m.candidate_name ? ' · ' + m.candidate_name : '');
        var unreadBadge = (m.unread_count | 0) > 0 ? ' <span class="nav-badge">' + (m.unread_count > 99 ? '99+' : m.unread_count) + '</span>' : '';
        html += '<li class="list-item-with-action"><div class="item-main">' + escapeHtml(m.vacancy_title || '') + ' — ' + escapeHtml(m.candidate_name || '') + ' <span class="match-status">' + escapeHtml(m.status || '') + '</span>' + unreadBadge + '</div>';
        html += '<div class="item-actions"><button type="button" class="btn-sm btn-outline" data-match-employer-view="' + i + '">View</button>';
        html += '<button type="button" class="btn-sm btn-primary" data-open-chat="' + m.id + '" data-chat-title="' + escapeHtml(chatTitle) + '" data-chat-back="matches" data-chat-is-employer="1" data-chat-match-status="' + escapeHtml(m.status || '') + '">Chat</button></div></li>';
      });
      html += '</ul></div>';
    } else {
      html += '<div class="list-card"><ul class="list-items list-matches">';
      matches.forEach(function (m) {
        var comment = (m.feedback_comment || '').trim();
        var chatTitle = (m.vacancy_title || '') + (m.employer_name ? ' · ' + m.employer_name : '');
        var unreadBadge = (m.unread_count | 0) > 0 ? ' <span class="nav-badge">' + (m.unread_count > 99 ? '99+' : m.unread_count) + '</span>' : '';
        html += '<li class="list-item-match" data-match-id="' + m.id + '"><div class="item-main">' + escapeHtml(m.vacancy_title || '') + ' <span class="match-status">' + escapeHtml(m.status || '') + '</span>' + unreadBadge + '</div>';
        html += '<textarea class="match-feedback-input" placeholder="Comment (optional)" data-match-id="' + m.id + '" rows="2">' + escapeHtml(comment) + '</textarea>';
        html += '<div class="match-actions"><button type="button" class="btn-sm btn-reaction' + (m.reaction === 'interested' ? ' active' : '') + '" data-match-id="' + m.id + '" data-reaction="interested">Interested</button>';
        html += '<button type="button" class="btn-sm btn-reaction' + (m.reaction === 'not_interested' ? ' active' : '') + '" data-match-id="' + m.id + '" data-reaction="not_interested">Not interested</button>';
        html += '<button type="button" class="btn-sm btn-primary btn-chat" data-open-chat="' + m.id + '" data-chat-title="' + escapeHtml(chatTitle) + '" data-chat-back="matches" data-chat-match-status="' + escapeHtml(m.status || '') + '">Chat</button></div></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="club-services">Back</button></div>';
    return html;
  }

  function renderOpenedResumesList(list) {
    list = ensureArray(list);
    var html = '<div class="screen" id="opened-resumes-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">Opened resumes</h1></div>';
    if (!list || list.length === 0) {
      html += '<div class="empty-state">No opened resumes yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      list.forEach(function (x, i) {
        var statusBadge = (x.match_status === 'offer_made' ? ' · Offer made' : '') + (x.match_status === 'dialog_closed' ? ' · Closed' : '');
        var label = (x.vacancy_company_name ? x.vacancy_company_name + ' · ' : '') + (x.vacancy_title || '') + ' — ' + (x.candidate_name || '') + statusBadge;
        var chatTitle = (x.vacancy_title || '') + (x.candidate_name ? ' · ' + x.candidate_name : '');
        html += '<li class="list-item-with-action"><div class="item-main">' + escapeHtml(label) + '</div>';
        html += '<div class="item-actions"><button type="button" class="btn-sm btn-primary" data-opened-index="' + i + '">View</button>';
        html += '<button type="button" class="btn-sm btn-outline" data-open-chat="' + x.match_id + '" data-chat-title="' + escapeHtml(chatTitle) + '" data-chat-back="opened-resumes" data-chat-is-employer="1" data-chat-match-status="' + escapeHtml(x.match_status || '') + '">Chat</button></div></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="club-services">Back</button></div>';
    return html;
  }

  function renderPendingApprovalList(list) {
    list = ensureArray(list);
    var html = '<div class="screen" id="pending-approval-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">Candidates</h1></div>';
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
    html += '<button type="button" class="btn-back" data-screen="club-services">Back</button></div>';
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
    var chatTitle = vacancyTitle + (candidateName ? ' · ' + candidateName : '');
    html += '</div><button type="button" class="btn-sm btn-primary" data-open-chat="' + item.match_id + '" data-chat-title="' + escapeHtml(chatTitle) + '" data-chat-back="opened-resumes" data-chat-is-employer="1" data-chat-match-status="' + escapeHtml(item.match_status || '') + '">Open chat</button>';
    html += '<button type="button" class="btn-back" data-screen="opened-resumes">Back to list</button></div>';
    return html;
  }

  function renderChatScreen(matchId, title, messages, isEmployer, matchStatus) {
    messages = ensureArray(messages);
    isEmployer = !!isEmployer;
    matchStatus = matchStatus || '';
    var isClosed = matchStatus === 'dialog_closed';
    var html = '<div class="screen chat-screen" id="chat-screen"><div class="screen-header">';
    html += '<button type="button" class="back-btn" id="chat-back-btn">‹</button>';
    html += '<h1 class="screen-title chat-title">' + escapeHtml(title || 'Chat') + '</h1></div>';
    html += '<div class="chat-messages" id="chat-messages">';
    messages.forEach(function (msg) {
      var css = msg.is_mine ? 'chat-msg mine' : 'chat-msg';
      var time = (msg.created_at || '').replace('T', ' ').substring(0, 16);
      html += '<div class="' + css + '"><div class="chat-msg-text">' + escapeHtml(msg.message || '') + '</div>';
      html += '<div class="chat-msg-meta">' + (msg.is_mine ? '' : escapeHtml(msg.sender_name || '') + ' · ') + escapeHtml(time) + '</div></div>';
    });
    html += '</div>';
    if (isClosed) {
      html += '<div class="chat-closed-notice">Dialog closed</div>';
    } else {
      html += '<div class="chat-input-wrap"><textarea id="chat-input" class="chat-input" placeholder="Message..." rows="2"></textarea>';
      html += '<button type="button" class="btn-sm btn-primary" id="chat-send-btn">Send</button></div>';
      if (isEmployer) {
        html += '<div class="chat-employer-actions">';
        if (matchStatus !== 'offer_made') html += '<button type="button" class="btn-sm btn-outline" id="chat-offer-btn">Make offer</button>';
        html += '<button type="button" class="btn-sm btn-outline" id="chat-close-dialog-btn">Close dialog</button></div>';
      }
    }
    html += '</div>';
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
        var tgUsername = x.telegram_username ? ' @' + x.telegram_username.replace(/^@+/, '') : '';
        var label = (x.candidate_name || '') + tgUsername + ' — ' + (x.resume && x.resume.title ? x.resume.title : 'Resume');
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
    var telegramUsername = item.telegram_username || '';
    var telegramId = item.telegram_id || 0;
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
      if (telegramUsername) html += '<p class="profile-line"><strong>Telegram:</strong> @' + escapeHtml(telegramUsername.replace(/^@+/, '')) + '</p>';
      if (skills) html += '<p class="profile-line"><strong>Skills:</strong> ' + escapeHtml(skills) + '</p>';
      if (tags) html += '<p class="profile-line"><strong>Tags:</strong> ' + escapeHtml(tags) + '</p>';
      html += '</div>';
    }
    html += '</div><button type="button" class="btn-back" data-screen="all-candidates">Back to list</button></div>';
    return html;
  }

  function renderCreateVacancyForm() {
    var html = '<div class="screen" id="create-vacancy-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">Create vacancy</h1></div>';
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
    var externalLinks = el ? el.querySelectorAll('[data-external-url]') : [];
    externalLinks.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = (this.getAttribute('data-external-url') || '').trim();
        if (!url) return;
        try {
          if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
            window.Telegram.WebApp.openLink(url);
          } else {
            window.open(url, '_blank', 'noopener');
          }
        } catch (e) {
          window.open(url, '_blank', 'noopener');
        }
      });
    });
    if (el) {
      // role is set in admin
    }
    var vacanciesStatusEl = document.getElementById('vacancies-status-filter');
    if (vacanciesStatusEl) {
      vacanciesStatusEl.addEventListener('change', function () {
        vacanciesStatusFilter = this.value || 'open';
        goTo('vacancies');
      });
    }
    var myVacanciesStatusEl = document.getElementById('my-vacancies-status-filter');
    if (myVacanciesStatusEl) {
      myVacanciesStatusEl.addEventListener('change', function () {
        myVacanciesStatusFilter = this.value || '';
        goTo('my-vacancies');
      });
    }
    var telegramLoginBtn = document.getElementById('telegram-login-btn');
    if (telegramLoginBtn) {
      telegramLoginBtn.addEventListener('click', function () {
        telegramLoginBtn.disabled = true;
        showLoading('Logging in...');
        window.HR_AUTH.login().then(function (me) {
          handleAuthenticated(me);
        }).catch(function (e) {
          showError(e.message || 'Auth failed', e);
        });
      });
    }
    var existingMemberBtn = document.getElementById('existing-member-btn');
    if (existingMemberBtn) {
      existingMemberBtn.addEventListener('click', function () {
        emailLinkStep = 'start';
        emailLinkAddress = '';
        setContent(renderExistingMemberScreen());
      });
    }
    var existingMemberBack = document.getElementById('existing-member-back');
    if (existingMemberBack) {
      existingMemberBack.addEventListener('click', function () {
        setContent(renderTelegramEntryScreen());
      });
    }
    var existingMemberSendBtn = document.getElementById('existing-member-send-btn');
    if (existingMemberSendBtn) {
      existingMemberSendBtn.addEventListener('click', function () {
        var emailEl = document.getElementById('existing-member-email');
        var email = emailEl ? (emailEl.value || '').trim() : '';
        if (!email) {
          alert('Enter your email.');
          return;
        }
        existingMemberSendBtn.disabled = true;
        window.HR_AUTH.requestEmailLinkCode(email).then(function () {
          emailLinkAddress = email;
          emailLinkStep = 'confirm';
          setContent(renderExistingMemberScreen());
        }).catch(function (e) {
          existingMemberSendBtn.disabled = false;
          alert((e && e.message) || 'Failed to send code');
        });
      });
    }
    var existingMemberResendBtn = document.getElementById('existing-member-resend-btn');
    if (existingMemberResendBtn) {
      existingMemberResendBtn.addEventListener('click', function () {
        if (!emailLinkAddress) {
          emailLinkStep = 'start';
          setContent(renderExistingMemberScreen());
          return;
        }
        existingMemberResendBtn.disabled = true;
        window.HR_AUTH.requestEmailLinkCode(emailLinkAddress).then(function () {
          setContent(renderExistingMemberScreen());
        }).catch(function (e) {
          existingMemberResendBtn.disabled = false;
          alert((e && e.message) || 'Failed to send code');
        });
      });
    }
    var existingMemberConfirmBtn = document.getElementById('existing-member-confirm-btn');
    if (existingMemberConfirmBtn) {
      existingMemberConfirmBtn.addEventListener('click', function () {
        var codeEl = document.getElementById('existing-member-code');
        var code = codeEl ? (codeEl.value || '').trim() : '';
        if (!emailLinkAddress) {
          alert('Enter email first.');
          return;
        }
        if (!code) {
          alert('Enter the verification code.');
          return;
        }
        existingMemberConfirmBtn.disabled = true;
        showLoading('Linking account...');
        window.HR_AUTH.confirmEmailLink(emailLinkAddress, code).then(function (me) {
          handleAuthenticated(me);
        }).catch(function (e) {
          emailLinkStep = 'confirm';
          setContent(renderExistingMemberScreen());
          alert((e && e.message) || 'Failed to confirm code');
        });
      });
    }
    var vipCheckSubmitBtn = document.getElementById('vip-check-submit');
    if (vipCheckSubmitBtn) {
      vipCheckSubmitBtn.addEventListener('click', function () {
        var emailEl = document.getElementById('vip-check-email');
        var resultEl = document.getElementById('vip-check-result');
        var email = emailEl ? (emailEl.value || '').trim() : '';
        if (!email) {
          if (resultEl) resultEl.textContent = 'Enter email.';
          return;
        }
        vipCheckSubmitBtn.disabled = true;
        if (resultEl) resultEl.textContent = 'Checking...';
        window.HR_API.post('/vip/check-email', { email: email }).then(function (resp) {
          vipCheckSubmitBtn.disabled = false;
          var label = (resp && resp.label) ? resp.label : 'Unverified member';
          if (resultEl) resultEl.textContent = 'Result: ' + label;
        }).catch(function (e) {
          vipCheckSubmitBtn.disabled = false;
          if (resultEl) resultEl.textContent = 'Error: ' + ((e && e.message) || 'Request failed');
        });
      });
    }
    var offerCb = document.getElementById('offer-accept-cb');
    var offerBtn = document.getElementById('offer-accept-btn');
    if (offerCb && offerBtn) {
      offerCb.addEventListener('change', function () { offerBtn.disabled = !offerCb.checked; });
      offerBtn.disabled = !offerCb.checked;
      offerBtn.addEventListener('click', function () {
        if (!offerCb.checked) return;
        offerBtn.disabled = true;
        window.HR_API.post('/me', { offer_accepted: true }).then(function () {
          return window.HR_API.get('/me');
        }).then(function (me) {
          profile = me;
          setContent(renderLinkedInStepScreen());
          var continueBtn = document.getElementById('linkedin-step-continue');
          if (continueBtn) {
            continueBtn.onclick = function () {
              var urlEl = document.getElementById('linkedin-step-url');
              var skipEl = document.getElementById('linkedin-step-skip');
              var url = (urlEl && urlEl.value) ? urlEl.value.trim() : '';
              var skipped = skipEl && skipEl.checked;
              if (!skipped && !url) {
                alert('Enter LinkedIn URL or check "I don\'t have LinkedIn".');
                return;
              }
              continueBtn.disabled = true;
              window.HR_API.post('/me', { linkedin_url: skipped ? '' : url, linkedin_skipped: skipped }).then(function () {
                return window.HR_API.get('/me');
              }).then(function (me) {
                profile = me;
                goTo('home');
              }).catch(function (e) {
                continueBtn.disabled = false;
                alert(e.message || 'Failed to save');
              });
            };
          }
        }).catch(function (e) {
          offerBtn.disabled = false;
          alert(e.message || 'Failed to save');
        });
      });
    }
    var profileSaveBtn = document.getElementById('profile-save-btn');
    if (profileSaveBtn) {
      profileSaveBtn.addEventListener('click', function () {
        var urlEl = document.getElementById('profile-linkedin-url');
        var skipEl = document.getElementById('profile-linkedin-skip');
        var url = (urlEl && urlEl.value) ? urlEl.value.trim() : '';
        var skipped = !!(skipEl && skipEl.checked);
        var firstNameEl = document.getElementById('profile-first-name');
        var lastNameEl = document.getElementById('profile-last-name');
        var skillsEl = document.getElementById('profile-skills');
        var tagsEl = document.getElementById('profile-tags');
        var payload = { linkedin_url: skipped ? '' : url, linkedin_skipped: skipped };
        if (firstNameEl) payload.first_name = (firstNameEl.value || '').trim();
        if (lastNameEl) payload.last_name = (lastNameEl.value || '').trim();
        if (skillsEl) payload.hr_skills = (skillsEl.value || '').trim();
        if (tagsEl) payload.hr_tags = (tagsEl.value || '').trim();
        profileSaveBtn.disabled = true;
        window.HR_API.post('/me', payload).then(function () {
          return window.HR_API.get('/me');
        }).then(function (me) {
          profile = me;
          setContent(renderProfile());
        }).catch(function (e) {
          profileSaveBtn.disabled = false;
          alert(e.message || 'Failed to save');
        });
      });
    }
    // Role is set in admin
    bindCustomActions();
  }

  function bindCustomActions() {
    var el = document.getElementById('app-content');
    if (!el) return;
    var webVersionBtn = document.getElementById('nav-web-version');
    if (webVersionBtn && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
      var webAppUrl = (window.HR_CONFIG && window.HR_CONFIG.WEB_APP_URL) ? (window.HR_CONFIG.WEB_APP_URL + '').trim() : '';
      if (webAppUrl) {
        webVersionBtn.addEventListener('click', function () { window.Telegram.WebApp.openLink(webAppUrl); });
      }
    }
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
            msg = 'Функция AI пока недоступна: настройте маршруты AI и API Key на сервере.';
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

    function checkResumeAndRespond(vacancyId, btn, onSuccess) {
      window.HR_API.get('/resumes/me').then(function (r) {
        var resume = (r && r.resume !== undefined) ? r.resume : r;
        var hasResume = resume && (resume.title || resume.content || resume.cv_url || (resume.cv_attachment_id && resume.cv_attachment_id > 0));
        if (!hasResume) {
          btn.disabled = false;
          alert('Fill in your resume first. Go to Club services → Place candidacy.');
          return;
        }
        window.HR_API.post('/vacancies/' + vacancyId + '/respond', {}).then(function () {
          if (onSuccess) onSuccess();
          else goTo('vacancies');
        }).catch(function (e) {
          btn.disabled = false;
          alert(e.message || 'Failed');
        });
      }).catch(function () {
        btn.disabled = false;
        alert('Fill in your resume first. Go to Club services → Place candidacy.');
      });
    }

    el.querySelectorAll('[data-respond-vacancy]').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-respond-vacancy');
        if (!id) return;
        this.disabled = true;
        checkResumeAndRespond(id, this);
      };
    });

    var detailRespondBtn = document.getElementById('vacancy-detail-respond-btn');
    if (detailRespondBtn) {
      detailRespondBtn.onclick = function () {
        var id = this.getAttribute('data-vacancy-id');
        if (!id) return;
        this.disabled = true;
        checkResumeAndRespond(id, this, function () {
          lastVacanciesAppliedIds[id] = true;
          goTo('vacancies');
        });
      };
    }
    var detailCloseBtn = document.getElementById('vacancy-detail-close-btn');
    if (detailCloseBtn) {
      detailCloseBtn.onclick = function () {
        var id = this.getAttribute('data-vacancy-id');
        if (!id || !confirm('Close this vacancy? It will no longer appear in open vacancies.')) return;
        detailCloseBtn.disabled = true;
        window.HR_API.post('/vacancies/' + id, { status: 'closed' }).then(function () {
          goTo('my-vacancies');
        }).catch(function (e) {
          detailCloseBtn.disabled = false;
          alert(e.message || 'Failed to close');
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
    el.querySelectorAll('[data-close-vacancy]').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-close-vacancy');
        if (!id || !confirm('Close this vacancy? It will no longer appear in open vacancies.')) return;
        var elBtn = this;
        elBtn.disabled = true;
        window.HR_API.post('/vacancies/' + id, { status: 'closed' }).then(function () {
          goTo('my-vacancies');
        }).catch(function (e) {
          elBtn.disabled = false;
          alert(e.message || 'Failed to close');
        });
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
    el.querySelectorAll('[data-match-employer-view]').forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(this.getAttribute('data-match-employer-view'), 10);
        var m = lastMatchesList[i];
        if (!m) return;
        var chatTitle = (m.vacancy_title || '') + (m.candidate_name ? ' · ' + m.candidate_name : '');
        var html = '<div class="screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="matches">‹</button><h1 class="screen-title">Match</h1></div>';
        html += '<div class="content-card"><p class="content-meta">' + escapeHtml(m.vacancy_title || '') + ' · ' + escapeHtml(m.candidate_name || '') + '</p>';
        html += '<p><span class="match-status">' + escapeHtml(m.status || '') + '</span></p></div>';
        html += '<button type="button" class="btn-primary" data-open-chat="' + m.id + '" data-chat-title="' + escapeHtml(chatTitle) + '" data-chat-back="matches" data-chat-is-employer="1" data-chat-match-status="' + escapeHtml(m.status || '') + '">Open chat</button>';
        html += '<button type="button" class="btn-back" data-screen="matches">Back to list</button></div>';
        setContent(html);
      };
    });
    el.querySelectorAll('[data-pending-approve]').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-pending-approve');
        if (!id) return;
        var that = this;
        that.disabled = true;
        window.HR_API.post('/matches/' + id, { status: 'confirmed' }).then(function () {
          goTo('pending-approval');
        }).catch(function (e) {
          that.disabled = false;
          var msg = (e.status ? 'Ошибка ' + e.status + ': ' : '') + (e.data && e.data.message ? e.data.message : (e.message || 'Failed'));
          if (e.message === 'Failed to fetch' || (e.message && e.message.indexOf('fetch') !== -1)) {
            msg = 'Не удалось связаться с сервером. Проверьте: 1) В config.js указан API_BASE_URL, доступный с телефона (например, https или ngrok). 2) Сервер запущен, ngrok туннель активен.';
          }
          alert(msg);
        });
      };
    });
    el.querySelectorAll('[data-pending-reject]').forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute('data-pending-reject');
        if (!id || !confirm('Reject this match?')) return;
        var that = this;
        that.disabled = true;
        window.HR_API.post('/matches/' + id, { status: 'rejected' }).then(function () {
          goTo('pending-approval');
        }).catch(function (e) {
          that.disabled = false;
          var msg = (e.status ? 'Ошибка ' + e.status + ': ' : '') + (e.data && e.data.message ? e.data.message : (e.message || 'Failed'));
          if (e.message === 'Failed to fetch' || (e.message && e.message.indexOf('fetch') !== -1)) {
            msg = 'Не удалось связаться с сервером. Проверьте: 1) В config.js указан API_BASE_URL, доступный с телефона (например, https или ngrok). 2) Сервер запущен, ngrok туннель активен.';
          }
          alert(msg);
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
        var row = document.querySelector('.list-item-match[data-match-id="' + matchId + '"]');
        var feedbackEl = row ? row.querySelector('.match-feedback-input') : null;
        var feedbackComment = (feedbackEl && feedbackEl.value) ? feedbackEl.value.trim() : '';
        var body = { reaction: reaction };
        if (feedbackComment) body.feedback_comment = feedbackComment;
        window.HR_API.post('/matches/' + matchId + '/reaction', body).then(function () {
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
    el.querySelectorAll('[data-open-chat]').forEach(function (btn) {
      btn.onclick = function () {
        var matchId = this.getAttribute('data-open-chat');
        var title = this.getAttribute('data-chat-title') || '';
        var back = this.getAttribute('data-chat-back') || 'club-services';
        var isEmployer = this.getAttribute('data-chat-is-employer') === '1';
        var matchStatus = this.getAttribute('data-chat-match-status') || '';
        if (!matchId) return;
        window.HR_CHAT_MATCH_ID = matchId;
        window.HR_CHAT_TITLE = title;
        window.HR_CHAT_BACK = back;
        window.HR_CHAT_IS_EMPLOYER = isEmployer;
        window.HR_CHAT_MATCH_STATUS = matchStatus;
        goTo('chat');
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
            msg = 'Функция AI пока недоступна: настройте маршруты AI и API Key на сервере.';
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
    if (screen === 'instruction') {
      setContent(renderInstruction());
      return;
    }
    if (screen === 'vip-check') {
      setContent(renderVipCheckScreen());
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
    if (screen === 'profile-edit') {
      setContent(renderProfileEdit());
      return;
    }
    if (screen === 'club-services') {
      Promise.all([
        window.HR_API.get('/me'),
        window.HR_API.get('/stats').catch(function () { return null; }),
        window.HR_API.get('/me/counts').catch(function () { return {}; }),
        window.HR_API.get('/ui/buttons').catch(function () { return []; })
      ]).then(function (arr) {
        profile = arr[0] || profile;
        var stats = arr[1];
        var counts = arr[2] || {};
        customUiButtons = ensureArray(arr[3]);
        setContent(renderClubServices(stats, counts, customUiButtons));
      }).catch(function () {
        setContent(renderClubServices(null, {}, []));
      });
      return;
    }
    if (screen === 'vacancies') {
      Promise.all([ window.HR_API.get('/vacancies?status=' + encodeURIComponent(vacanciesStatusFilter || 'open')), window.HR_API.get('/applications/me') ]).then(function (arr) {
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
      var path = '/vacancies/me';
      if (myVacanciesStatusFilter) path += '?status=' + encodeURIComponent(myVacanciesStatusFilter);
      window.HR_API.get(path).then(function (raw) {
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
        var html = '<div class="screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="club-services">‹</button><h1 class="screen-title">My resume</h1></div>';
        html += '<div class="error">' + escapeHtml(msg) + '</div>';
        html += '<button type="button" class="btn-back" data-screen="resume">Повторить</button>';
        html += ' <button type="button" class="btn-back" data-screen="club-services">На главную</button></div>';
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
        lastMatchesList = list;
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
    if (screen === 'chat') {
      var matchId = window.HR_CHAT_MATCH_ID;
      var title = window.HR_CHAT_TITLE || 'Chat';
      var backScreen = window.HR_CHAT_BACK || 'club-services';
      if (!matchId) {
        goTo(backScreen);
        return;
      }
      var isEmployer = !!window.HR_CHAT_IS_EMPLOYER;
      var matchStatus = window.HR_CHAT_MATCH_STATUS || '';
      window.HR_API.get('/matches/' + matchId + '/messages').then(function (raw) {
        var list = ensureArray(raw);
        setContent(renderChatScreen(matchId, title, list, isEmployer, matchStatus));
        var backBtn = document.getElementById('chat-back-btn');
        if (backBtn) backBtn.onclick = function () { goTo(backScreen); };
        var sendBtn = document.getElementById('chat-send-btn');
        var inputEl = document.getElementById('chat-input');
        if (sendBtn && inputEl) {
          sendBtn.onclick = function () {
            var text = (inputEl.value || '').trim();
            if (!text) return;
            sendBtn.disabled = true;
            window.HR_API.post('/matches/' + matchId + '/messages', { message: text }).then(function () {
              inputEl.value = '';
              goTo('chat');
            }).catch(function (e) {
              sendBtn.disabled = false;
              alert(e.message || 'Failed to send');
            });
          };
        }
        var offerBtn = document.getElementById('chat-offer-btn');
        if (offerBtn) {
          offerBtn.onclick = function () {
            offerBtn.disabled = true;
            window.HR_API.post('/matches/' + matchId + '/employer-action', { action: 'offer_made' }).then(function () {
              window.HR_CHAT_MATCH_STATUS = 'offer_made';
              goTo('chat');
            }).catch(function (e) {
              offerBtn.disabled = false;
              alert(e.message || 'Failed');
            });
          };
        }
        var closeBtn = document.getElementById('chat-close-dialog-btn');
        if (closeBtn) {
          closeBtn.onclick = function () {
            closeBtn.disabled = true;
            window.HR_API.post('/matches/' + matchId + '/employer-action', { action: 'dialog_closed' }).then(function () {
              goTo(backScreen);
            }).catch(function (e) {
              closeBtn.disabled = false;
              alert(e.message || 'Failed');
            });
          };
        }
      }).catch(function (e) {
        showError(e.message || 'Failed to load chat', e);
        setTimeout(function () { goTo(backScreen); }, 1500);
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
    setContent(renderHome());
  }

  function renderDevLogin() {
    var base = (window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL) || window.location.origin;
    var url = base.replace(/\/$/, '') + '/wp-json/hr/v1/dev-token';
    var hasBot = (window.HR_CONFIG && window.HR_CONFIG.TELEGRAM_BOT_USERNAME) ? (window.HR_CONFIG.TELEGRAM_BOT_USERNAME + '').trim() : '';
    var html = '<div class="screen dev-login">';
    html += '<h1 class="screen-title">Log in</h1>';
    if (hasBot) {
      html += '<p class="hint">Log in with your Telegram account (web version):</p>';
      html += '<div id="telegram-widget-container"></div>';
      html += '<p class="section-label">Or use token</p>';
    }
    html += '<p class="hint">Get a token from the admin panel: open the site in the same browser, run in console:</p>';
    html += '<pre class="code">fetch("' + escapeHtml(url) + '", { credentials: "include", headers: { "X-WP-Nonce": wpApiSettings.nonce } }).then(r=>r.json()).then(d=>alert(d.token))</pre>';
    html += '<p class="hint">Paste the token below or open with <code>?dev=1&token=YOUR_TOKEN</code></p>';
    html += '<input type="text" id="dev-token-input" placeholder="Paste token" />';
    html += '<button type="button" id="dev-token-submit">Use token</button>';
    html += '</div>';
    return html;
  }

  function handleAuthenticated(me) {
    profile = me || profile;
    try {
      var appTitle = (window.HR_CONFIG && window.HR_CONFIG.APP_TITLE) ? (window.HR_CONFIG.APP_TITLE + '').trim() : '';
      if (appTitle) document.title = appTitle;
    } catch (e) {}
    if (profile.offer_text && (profile.offer_text + '').trim() && !profile.offer_accepted) {
      setContent(renderOfferScreen());
      return;
    }
    goTo('home');
  }

  function init() {
    try {
      var root = document.documentElement;
      var cfg = window.HR_CONFIG || {};
      if (cfg.BRAND_PRIMARY) root.style.setProperty('--hr-primary', cfg.BRAND_PRIMARY);
      if (cfg.BRAND_ACCENT) root.style.setProperty('--hr-accent', cfg.BRAND_ACCENT);
      if (cfg.BRAND_BG) root.style.setProperty('--hr-bg', cfg.BRAND_BG);
      if (cfg.BRAND_CARD_BG) root.style.setProperty('--hr-card-bg', cfg.BRAND_CARD_BG);
    } catch (e) {}

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
    var authPromise = (window.HR_AUTH.tryAuthFromWidgetRedirect && window.HR_AUTH.tryAuthFromWidgetRedirect()) || Promise.resolve(false);
    authPromise.then(function (handled) {
      if (handled) return;
      var inTelegram = window.HR_AUTH.getTelegramInitData && window.HR_AUTH.getTelegramInitData();
      if (inTelegram) {
        var tgSavedToken = window.HR_API.getToken && window.HR_API.getToken();
        if (tgSavedToken) {
          showLoading('Logging in...');
          window.HR_AUTH.ensureAuth().then(function (me) {
            handleAuthenticated(me);
          }).catch(function () {
            window.HR_API.setToken(null);
            setContent(renderTelegramEntryScreen());
          });
          return;
        }
        setContent(renderTelegramEntryScreen());
        return;
      }
      var savedToken = window.HR_API.getToken && window.HR_API.getToken();
      if (savedToken) {
        showLoading('Logging in...');
        window.HR_AUTH.ensureAuth().then(function (me) {
          handleAuthenticated(me);
        }).catch(function () {
          window.HR_API.setToken(null);
          setContent(renderDevLogin());
          injectTelegramLoginWidget();
        });
        return;
      }
      setContent(renderDevLogin());
      injectTelegramLoginWidget();
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
            handleAuthenticated(me);
          }).catch(function () {
            window.HR_API.setToken(null);
            window.HR_AUTH.setDevToken(null);
            setContent(renderDevLogin());
            injectTelegramLoginWidget();
            alert('Invalid or expired token.');
          });
        });
      }
    });
  }

  function injectTelegramLoginWidget() {
    var botUsername = (window.HR_CONFIG && window.HR_CONFIG.TELEGRAM_BOT_USERNAME) ? (window.HR_CONFIG.TELEGRAM_BOT_USERNAME + '').trim() : '';
    var container = document.getElementById('telegram-widget-container');
    if (!container || !botUsername) return;
    if (container.querySelector('script[data-telegram-login]')) return;
    var authUrl = window.location.origin + (window.location.pathname || '/');
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', botUsername);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-auth-url', authUrl);
    s.setAttribute('data-request-access', 'write');
    container.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
