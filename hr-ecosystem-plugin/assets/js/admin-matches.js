(function ($) {
	'use strict';

	var apiRoot, nonce;

	function escapeHtml(text) {
		var div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	function hideAll() {
		$('#hr-match-suggestions-loading, #hr-match-suggestions-list, #hr-match-suggestions-empty, #hr-match-suggestions-error').hide();
	}

	function showError(msg) {
		hideAll();
		$('#hr-match-suggestions-error p').text(msg || 'Request failed.');
		$('#hr-match-suggestions-error').show();
	}

	function loadSuggestions() {
		if (typeof wpApiSettings === 'undefined' || !wpApiSettings.root || !wpApiSettings.nonce) {
			showError('REST API nonce not available. Reload the page.');
			return;
		}
		apiRoot = wpApiSettings.root.replace(/\/$/, '');
		nonce = wpApiSettings.nonce;

		$('#hr-match-suggestions-loading').show();
		hideAll();
		$('#hr-match-suggestions-loading').show();

		$.ajax({
			url: apiRoot + '/hr/v1/matches/suggestions',
			method: 'GET',
			beforeSend: function (xhr) {
				xhr.setRequestHeader('X-WP-Nonce', nonce);
			},
			credentials: 'include'
		})
			.done(function (data) {
				$('#hr-match-suggestions-loading').hide();
				if (!data || data.length === 0) {
					$('#hr-match-suggestions-empty').show();
					return;
				}
				var html = '<table class="wp-list-table widefat fixed striped"><thead><tr>' +
					'<th>' + escapeHtml('Vacancy') + '</th>' +
					'<th>' + escapeHtml('Candidate') + '</th>' +
					'<th style="width:80px;">' + escapeHtml('Score') + '</th>' +
					'<th style="width:140px;">' + escapeHtml('Action') + '</th></tr></thead><tbody>';
				data.forEach(function (row) {
					html += '<tr data-vacancy-id="' + parseInt(row.vacancy_id, 10) + '" data-candidate-id="' + parseInt(row.candidate_id, 10) + '">' +
						'<td>' + escapeHtml(row.vacancy_title || '') + '</td>' +
						'<td>' + escapeHtml(row.candidate_name || '') + '</td>' +
						'<td>' + escapeHtml(String(row.match_score != null ? row.match_score : '')) + '</td>' +
						'<td><button type="button" class="button button-primary hr-create-match-btn">Create match</button></td></tr>';
				});
				html += '</tbody></table>';
				$('#hr-match-suggestions-list').html(html).show();
			})
			.fail(function (xhr) {
				var msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : (xhr.statusText || 'Request failed.');
				if (xhr.status === 403) {
					msg = 'Access denied. Admin rights required.';
				}
				showError(msg);
			});
	}

	function createMatch(vacancyId, candidateId, $row) {
		var $btn = $row.find('.hr-create-match-btn');
		$btn.prop('disabled', true).text('Creating…');
		$.ajax({
			url: apiRoot + '/hr/v1/matches',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ vacancy_id: vacancyId, candidate_id: candidateId }),
			beforeSend: function (xhr) {
				xhr.setRequestHeader('X-WP-Nonce', nonce);
			},
			credentials: 'include'
		})
			.done(function () {
				$row.fadeOut(300, function () {
					$(this).remove();
					if ($('#hr-match-suggestions-list tbody tr').length === 0) {
						$('#hr-match-suggestions-list').hide();
						$('#hr-match-suggestions-empty').show();
					}
				});
			})
			.fail(function (xhr) {
				var msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : (xhr.statusText || 'Failed to create match.');
				$btn.prop('disabled', false).text('Create match');
				alert(msg);
			});
	}

	$(function () {
		loadSuggestions();
		$(document).on('click', '.hr-create-match-btn', function () {
			var $row = $(this).closest('tr');
			var vacancyId = $row.data('vacancy-id');
			var candidateId = $row.data('candidate-id');
			if (vacancyId && candidateId) {
				createMatch(vacancyId, candidateId, $row);
			}
		});
	});
})(jQuery);
