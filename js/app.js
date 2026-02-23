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

  function showLoading(msg) {
    var el = document.getElementById('app-content');
    if (!el) return;
    el.innerHTML = '<div class="loading">' + (msg || 'Loading...') + '</div>';
  }

  function showError(msg) {
    var el = document.getElementById('app-content');
    if (!el) return;
    el.innerHTML = '<div class="error">' + (msg || 'Something went wrong.') + '</div>';
  }

  function renderHome() {
    var role = (profile && profile.role) || 'candidate';
    var name = (profile && (profile.first_name || profile.last_name ? (profile.first_name + ' ' + profile.last_name).trim() : '')) || 'User';
    if (!name) name = 'User';
    var html = '<div class="screen home">';
    html += '<div class="welcome-card">';
    html += '<p class="greeting">Welcome back</p>';
    html += '<p class="user-name">' + escapeHtml(name) + '</p>';
    html += '<span class="role-badge">' + escapeHtml(role) + '</span>';
    html += '</div>';
    html += '<p class="home-hint">Choose what you need:</p>';
    html += '<div class="nav-cards">';
    if (role === 'candidate' || role === 'admin') {
      html += '<p class="section-label">I\'m looking for a job</p>';
      html += '<button type="button" class="nav-card" data-screen="vacancies"><span>Vacancies</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="resume"><span>My resume</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="applications"><span>My applications</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="matches"><span>My matches</span><span class="arrow">›</span></button>';
    }
    if (role === 'employer' || role === 'admin') {
      html += '<p class="section-label">I want to post a vacancy (HR)</p>';
      html += '<button type="button" class="nav-card" data-screen="my-vacancies"><span>My vacancies</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="create-vacancy"><span>Create vacancy</span><span class="arrow">›</span></button>';
      html += '<button type="button" class="nav-card" data-screen="opened-resumes"><span>Opened resumes</span><span class="arrow">›</span></button>';
    }
    html += '<p class="section-label">Account</p>';
    html += '<button type="button" class="nav-card" data-screen="profile"><span>Profile</span><span class="arrow">›</span></button>';
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
    var name = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || '—';
    var html = '<div class="screen profile">';
    html += '<div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Profile</h1></div>';
    html += '<div class="profile-card">';
    html += '<div class="field"><div class="field-label">Name</div><div class="field-value">' + escapeHtml(name) + '</div></div>';
    html += '<div class="field"><div class="field-label">Role</div><div class="field-value">' + escapeHtml(p.role || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">Status</div><div class="field-value">' + escapeHtml(p.hr_status || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">Skills</div><div class="field-value">' + escapeHtml(p.hr_skills || '—') + '</div></div>';
    html += '<div class="field"><div class="field-label">Tags</div><div class="field-value">' + escapeHtml(p.hr_tags || '—') + '</div></div>';
    html += '</div><button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderList(title, items, itemLabel) {
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
    var html = '<div class="screen" id="resume-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">My resume</h1></div>';
    html += '<div class="content-card"><p class="content-title">' + escapeHtml(r.title || 'Resume') + '</p>';
    html += '<div class="content-body">' + escapeHtml(r.content || '') + '</div>';
    if (r.cv_url) html += '<a href="' + escapeHtml(r.cv_url) + '" target="_blank" class="link-cv">Download CV</a>';
    html += '</div>';
    html += '<button type="button" class="btn-primary" id="resume-edit-btn">Edit resume</button>';
    html += ' <button type="button" class="btn-danger" id="resume-delete-btn">Delete resume</button>';
    html += ' <button type="button" class="btn-back" data-screen="home">Back</button></div>';
    return html;
  }

  function renderResumeForm(r) {
    r = r || {};
    var html = '<div class="screen" id="resume-form-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="resume">‹</button><h1 class="screen-title">' + (r.id ? 'Edit resume' : 'Create resume') + '</h1></div>';
    html += '<div class="form-card"><label class="field-label">Title</label><input type="text" id="resume-title" value="' + escapeHtml(r.title || '') + '" placeholder="e.g. Senior Developer" />';
    html += '<label class="field-label">About you (text)</label><textarea id="resume-content" rows="6" placeholder="Experience, skills...">' + escapeHtml(r.content || '') + '</textarea>';
    html += '<label class="field-label">Attach CV (PDF, DOC)</label><input type="file" id="resume-cv-file" accept=".pdf,.doc,.docx" class="input-file" />';
    if (r.cv_url) html += '<p class="hint">Current file: <a href="' + escapeHtml(r.cv_url) + '" target="_blank">Download CV</a></p>';
    html += '<button type="button" class="btn-primary" id="resume-save-btn">Save</button></div></div>';
    return html;
  }

  function renderVacanciesWithRespond(vacancies, appliedIds) {
    appliedIds = appliedIds || {};
    var html = '<div class="screen" id="vacancies-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Vacancies</h1></div>';
    if (!vacancies || vacancies.length === 0) {
      html += '<div class="empty-state">No vacancies yet.</div>';
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
    var html = '<div class="screen" id="my-vacancies-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">My vacancies</h1></div>';
    if (!list || list.length === 0) {
      html += '<div class="empty-state">No vacancies yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      list.forEach(function (v, i) {
        html += '<li class="list-item-with-action"><div class="item-main">' + escapeHtml(v.title || '') + '</div>';
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
    var html = '<div class="screen" id="opened-resumes-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Opened resumes</h1></div>';
    if (!list || list.length === 0) {
      html += '<div class="empty-state">No opened resumes yet.</div>';
    } else {
      html += '<div class="list-card"><ul class="list-items">';
      list.forEach(function (x, i) {
        var label = (x.vacancy_title || '') + ' — ' + (x.candidate_name || '');
        html += '<li class="list-item-with-action"><div class="item-main">' + escapeHtml(label) + '</div>';
        html += '<button type="button" class="btn-sm btn-primary" data-opened-index="' + i + '">View</button></li>';
      });
      html += '</ul></div>';
    }
    html += '<button type="button" class="btn-back" data-screen="home">Back</button></div>';
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

  function renderCreateVacancyForm() {
    var html = '<div class="screen" id="create-vacancy-screen"><div class="screen-header"><button type="button" class="back-btn" data-screen="home">‹</button><h1 class="screen-title">Create vacancy</h1></div>';
    html += '<div class="form-card"><label class="field-label">Title *</label><input type="text" id="vacancy-title" placeholder="Job title" />';
    html += '<label class="field-label">Description</label><textarea id="vacancy-content" rows="5" placeholder="Requirements, responsibilities..."></textarea>';
    html += '<label class="field-label">Required skills</label><input type="text" id="vacancy-skills" placeholder="e.g. PHP, React" />';
    html += '<label class="field-label">Tags</label><input type="text" id="vacancy-tags" placeholder="e.g. remote, full-time" />';
    html += '<button type="button" class="btn-primary" id="vacancy-submit-btn">Publish</button></div></div>';
    return html;
  }

  function setContent(html) {
    var el = document.getElementById('app-content');
    if (el) el.innerHTML = html;
    var buttons = document.querySelectorAll('[data-screen]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        goTo(this.getAttribute('data-screen'));
      });
    });
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
          setContent(renderResumeForm(r));
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
        var title = (document.getElementById('resume-title') && document.getElementById('resume-title').value) || '';
        var content = (document.getElementById('resume-content') && document.getElementById('resume-content').value) || '';
        var fileInput = document.getElementById('resume-cv-file');
        var file = fileInput && fileInput.files && fileInput.files[0];
        saveBtn.disabled = true;
        var doSave = function (cvId) {
          window.HR_API.post('/resumes/me', { title: title, content: content, cv_attachment_id: cvId || 0 }).then(function (r) {
            setContent(renderResumeView(r));
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
          alert('Title is required');
          return;
        }
        var content = (document.getElementById('vacancy-content') && document.getElementById('vacancy-content').value) || '';
        var skills = (document.getElementById('vacancy-skills') && document.getElementById('vacancy-skills').value) || '';
        var tags = (document.getElementById('vacancy-tags') && document.getElementById('vacancy-tags').value) || '';
        vacancySubmit.disabled = true;
        window.HR_API.post('/vacancies', { title: title.trim(), content: content, skills_required: skills, tags: tags }).then(function () {
          goTo('my-vacancies');
        }).catch(function (e) {
          vacancySubmit.disabled = false;
          alert(e.message || 'Failed to create');
        });
      };
    }
  }

  function goTo(screen) {
    currentScreen = screen;
    showLoading();
    if (screen === 'home') {
      setContent(renderHome());
      return;
    }
    if (screen === 'profile') {
      setContent(renderProfile());
      return;
    }
    if (screen === 'vacancies') {
      Promise.all([ window.HR_API.get('/vacancies'), window.HR_API.get('/applications/me') ]).then(function (arr) {
        var list = arr[0] || [];
        var applications = arr[1] || [];
        var appliedIds = {};
        applications.forEach(function (a) { appliedIds[a.vacancy_id] = true; });
        lastVacanciesList = list;
        lastVacanciesAppliedIds = appliedIds;
        setContent(renderVacanciesWithRespond(list, appliedIds));
      }).catch(function (e) {
        showError(e.message || 'Failed to load vacancies');
      });
      return;
    }
    if (screen === 'my-vacancies') {
      window.HR_API.get('/vacancies/me').then(function (list) {
        lastMyVacanciesList = list || [];
        setContent(renderMyVacanciesList(lastMyVacanciesList));
      }).catch(function (e) {
        showError(e.message || 'Failed to load');
      });
      return;
    }
    if (screen === 'resume') {
      window.HR_API.get('/resumes/me').then(function (r) {
        if (!r || r.resume === null || !r.id) setContent(renderResumeForm({}));
        else setContent(renderResumeView(r));
      }).catch(function (e) {
        setContent(renderResumeForm({}));
      });
      return;
    }
    if (screen === 'applications') {
      window.HR_API.get('/applications/me').then(function (list) {
        setContent(renderList('My applications', list, function (a) { return (a.vacancy_title || a.vacancy_id) + ' — ' + (a.status || ''); }));
      }).catch(function (e) {
        showError(e.message || 'Failed to load');
      });
      return;
    }
    if (screen === 'matches') {
      window.HR_API.get('/matches/me').then(function (list) {
        setContent(renderMatchesWithReaction(list));
      }).catch(function (e) {
        showError(e.message || 'Failed to load');
      });
      return;
    }
    if (screen === 'opened-resumes') {
      window.HR_API.get('/resumes/opened').then(function (list) {
        lastOpenedResumesList = list || [];
        setContent(renderOpenedResumesList(lastOpenedResumesList));
      }).catch(function (e) {
        showError(e.message || 'Failed to load');
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
    showLoading('Logging in...');
    window.HR_AUTH.ensureAuth()
      .then(function (data) {
        if (data && data.user_id && !data.role) {
          return window.HR_API.get('/me').then(function (me) {
            profile = me;
            return me;
          });
        }
        if (data && (data.role || data.id)) {
          profile = data;
          return data;
        }
        return window.HR_API.get('/me').then(function (me) {
          profile = me;
          return me;
        });
      })
      .then(function () {
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
        showError(msg);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
