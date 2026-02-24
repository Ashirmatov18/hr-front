<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HR_Ecosystem_Admin {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'add_meta_boxes', array( $this, 'add_vacancy_meta_box' ) );
		add_action( 'add_meta_boxes', array( $this, 'add_employer_meta_box' ) );
		add_action( 'add_meta_boxes', array( $this, 'add_match_meta_box' ) );
		add_action( 'save_post_vacancy', array( $this, 'save_vacancy_employer' ), 10, 2 );
		add_action( 'save_post_hr_match', array( $this, 'save_match_status' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_rest_nonce' ), 1 );
		
		// AJAX for AI
		add_action( 'wp_ajax_hr_parse_vacancy', array( $this, 'ajax_parse_vacancy' ) );
		
		// Export Handler
		add_action( 'admin_post_hr_export_candidates', array( $this, 'handle_export' ) );

		// User profile: Club badge and HR fields
		add_action( 'show_user_profile', array( $this, 'render_user_hr_fields' ) );
		add_action( 'edit_user_profile', array( $this, 'render_user_hr_fields' ) );
		add_action( 'personal_options_update', array( $this, 'save_user_hr_fields' ) );
		add_action( 'edit_user_profile_update', array( $this, 'save_user_hr_fields' ) );
	}

	/**
	 * Add wpApiSettings (root, nonce) to all admin pages for REST API calls from console.
	 */
	public function enqueue_rest_nonce() {
		wp_localize_script( 'jquery', 'wpApiSettings', array(
			'root'  => esc_url_raw( rest_url() ),
			'nonce' => wp_create_nonce( 'wp_rest' ),
		) );
	}

	public function add_admin_menu() {
		add_menu_page(
			'HR Ecosystem',
			'HR Ecosystem',
			'manage_options',
			'hr-ecosystem',
			array( $this, 'render_settings_page' ),
			'dashicons-groups',
			50
		);
		add_submenu_page(
			'hr-ecosystem',
			__( 'Match suggestions', 'hr-ecosystem' ),
			__( 'Match suggestions', 'hr-ecosystem' ),
			'manage_options',
			'hr-match-suggestions',
			array( $this, 'render_match_suggestions_page' )
		);
	}

	/**
	 * Блок «HR Ecosystem» на странице редактирования пользователя: Club badge и др.
	 */
	public function render_user_hr_fields( $user ) {
		if ( ! current_user_can( 'edit_users' ) ) {
			return;
		}
		$club_badge = (bool) get_user_meta( $user->ID, 'club_badge', true );
		$hr_status  = get_user_meta( $user->ID, 'hr_status', true );
		$hr_skills  = get_user_meta( $user->ID, 'hr_skills', true );
		$hr_tags    = get_user_meta( $user->ID, 'hr_tags', true );
		?>
		<h2><?php esc_html_e( 'HR Ecosystem', 'hr-ecosystem' ); ?></h2>
		<table class="form-table">
			<tr>
				<th><label for="hr_club_badge"><?php esc_html_e( 'Club badge', 'hr-ecosystem' ); ?></label></th>
				<td>
					<label>
						<input type="checkbox" name="hr_club_badge" id="hr_club_badge" value="1" <?php checked( $club_badge ); ?> />
						<?php esc_html_e( 'Access to exclusive vacancies', 'hr-ecosystem' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'If enabled, user sees all vacancies. If disabled — only from "Public" category.', 'hr-ecosystem' ); ?></p>
				</td>
			</tr>
			<tr>
				<th><label for="hr_status"><?php esc_html_e( 'Candidate status', 'hr-ecosystem' ); ?></label></th>
				<td>
					<select name="hr_status" id="hr_status">
						<option value="passive" <?php selected( $hr_status, 'passive' ); ?>><?php esc_html_e( 'Passive search', 'hr-ecosystem' ); ?></option>
						<option value="active_search" <?php selected( $hr_status, 'active_search' ); ?>><?php esc_html_e( 'Actively looking', 'hr-ecosystem' ); ?></option>
						<option value="not_looking" <?php selected( $hr_status, 'not_looking' ); ?>><?php esc_html_e( 'Not looking', 'hr-ecosystem' ); ?></option>
					</select>
					<p class="description"><?php esc_html_e( 'Relevant for candidates.', 'hr-ecosystem' ); ?></p>
				</td>
			</tr>
			<tr>
				<th><label for="hr_skills"><?php esc_html_e( 'Skills (candidate)', 'hr-ecosystem' ); ?></label></th>
				<td>
					<input type="text" name="hr_skills" id="hr_skills" value="<?php echo esc_attr( $hr_skills ); ?>" class="large-text" placeholder="<?php esc_attr_e( 'PHP, JavaScript, project management…', 'hr-ecosystem' ); ?>" />
					<p class="description"><?php esc_html_e( 'Comma-separated or free text.', 'hr-ecosystem' ); ?></p>
				</td>
			</tr>
			<tr>
				<th><label for="hr_tags"><?php esc_html_e( 'Tags (candidate)', 'hr-ecosystem' ); ?></label></th>
				<td>
					<input type="text" name="hr_tags" id="hr_tags" value="<?php echo esc_attr( $hr_tags ); ?>" class="large-text" placeholder="<?php esc_attr_e( 'remote, startup, team lead…', 'hr-ecosystem' ); ?>" />
					<p class="description"><?php esc_html_e( 'Comma-separated. For filtering and matching.', 'hr-ecosystem' ); ?></p>
				</td>
			</tr>
		</table>
		<?php
	}

	public function save_user_hr_fields( $user_id ) {
		if ( ! current_user_can( 'edit_users' ) ) {
			return;
		}
		if ( isset( $_POST['hr_club_badge'] ) ) {
			update_user_meta( $user_id, 'club_badge', 1 );
		} else {
			update_user_meta( $user_id, 'club_badge', 0 );
		}
		if ( isset( $_POST['hr_status'] ) ) {
			$status = sanitize_text_field( $_POST['hr_status'] );
			if ( in_array( $status, array( 'active_search', 'passive', 'not_looking' ), true ) ) {
				update_user_meta( $user_id, 'hr_status', $status );
			}
		}
		if ( isset( $_POST['hr_skills'] ) ) {
			update_user_meta( $user_id, 'hr_skills', sanitize_text_field( $_POST['hr_skills'] ) );
		}
		if ( isset( $_POST['hr_tags'] ) ) {
			update_user_meta( $user_id, 'hr_tags', sanitize_text_field( $_POST['hr_tags'] ) );
		}
	}

	public function register_settings() {
		register_setting( 'hr_ecosystem_options', 'hr_telegram_bot_token' );
		register_setting( 'hr_ecosystem_options', 'hr_openai_api_key' );
	}

	public function render_settings_page() {
		?>
		<div class="wrap">
			<h1>HR Ecosystem Settings</h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'hr_ecosystem_options' );
				do_settings_sections( 'hr_ecosystem_options' );
				?>
				<table class="form-table">
					<tr valign="top">
						<th scope="row">Telegram Bot Token</th>
						<td><input type="text" name="hr_telegram_bot_token" value="<?php echo esc_attr( get_option( 'hr_telegram_bot_token' ) ); ?>" class="regular-text" /></td>
					</tr>
					<tr valign="top">
						<th scope="row">OpenAI API Key</th>
						<td><input type="password" name="hr_openai_api_key" value="<?php echo esc_attr( get_option( 'hr_openai_api_key' ) ); ?>" class="regular-text" /></td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>

			<hr>
			<h2>Export Candidates</h2>
			<p>Download a CSV list of all candidates.</p>
			<form method="post" action="<?php echo admin_url( 'admin-post.php' ); ?>">
				<input type="hidden" name="action" value="hr_export_candidates">
				<?php wp_nonce_field( 'hr_export_action', 'hr_export_nonce' ); ?>
				<button type="submit" class="button button-primary">Export to CSV</button>
			</form>
		</div>
		<?php
	}

	/**
	 * Страница «Предложения мэтчей»: заявки без мэтча, кнопка «Создать мэтч».
	 */
	public function render_match_suggestions_page() {
		wp_enqueue_script(
			'hr-admin-matches',
			HR_ECO_URL . 'assets/js/admin-matches.js',
			array( 'jquery' ),
			'1.0',
			true
		);
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Match suggestions', 'hr-ecosystem' ); ?></h1>
			<p class="description"><?php esc_html_e( 'Applications that do not have a match yet. Click "Create match" to link the vacancy and the candidate.', 'hr-ecosystem' ); ?></p>
			<div id="hr-match-suggestions-loading" style="margin: 1em 0;"><?php esc_html_e( 'Loading…', 'hr-ecosystem' ); ?></div>
			<div id="hr-match-suggestions-list" style="display:none;"></div>
			<div id="hr-match-suggestions-empty" style="display:none;" class="notice notice-info">
				<p><?php esc_html_e( 'No suggestions. All applications already have a match, or there are no applications.', 'hr-ecosystem' ); ?></p>
			</div>
			<div id="hr-match-suggestions-error" style="display:none;" class="notice notice-error">
				<p></p>
			</div>
		</div>
		<?php
	}

	/**
	 * Export Logic
	 */
	public function handle_export() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		check_admin_referer( 'hr_export_action', 'hr_export_nonce' );

		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=candidates-' . date( 'Y-m-d' ) . '.csv' );

		$output = fopen( 'php://output', 'w' );
		
		// BOM for Excel
		fputs( $output, "\xEF\xBB\xBF" );

		// Header
		fputcsv( $output, array( 'ID', 'Name', 'Telegram ID', 'Status', 'LinkedIn', 'Club Badge', 'Skills', 'Tags' ) );

		// Get Users
		// Ideally, we filter by role or meta. For now, get all users who have 'hr_status'
		$users = get_users( array(
			'meta_key' => 'hr_status', // Only those who interacted
			'number' => -1
		) );

		foreach ( $users as $user ) {
			$status   = get_user_meta( $user->ID, 'hr_status', true );
			$tg_id    = get_user_meta( $user->ID, 'telegram_id', true );
			$linkedin = get_user_meta( $user->ID, 'linkedin_url', true );
			$badge    = get_user_meta( $user->ID, 'club_badge', true ) ? 'Yes' : 'No';
			$skills   = get_user_meta( $user->ID, 'hr_skills', true );
			$tags     = get_user_meta( $user->ID, 'hr_tags', true );
			fputcsv( $output, array(
				$user->ID,
				$user->display_name,
				$tg_id,
				$status,
				$linkedin,
				$badge,
				$skills,
				$tags,
			) );
		}

		fclose( $output );
		exit;
	}

	/**
	 * Meta Box for AI
	 */
	public function add_vacancy_meta_box() {
		add_meta_box(
			'hr_ai_import',
			'AI Job Import',
			array( $this, 'render_ai_meta_box' ),
			'vacancy',
			'normal',
			'high'
		);
	}

	/**
	 * Meta box: привязка вакансии к работодателю (роль hr_employer)
	 */
	public function add_employer_meta_box() {
		add_meta_box(
			'hr_vacancy_employer',
			'Employer',
			array( $this, 'render_employer_meta_box' ),
			'vacancy',
			'side',
			'default'
		);
		add_meta_box(
			'hr_vacancy_skills_tags',
			'Tags & skills (HR)',
			array( $this, 'render_vacancy_skills_tags_meta_box' ),
			'vacancy',
			'normal',
			'default'
		);
	}

	public function render_employer_meta_box( $post ) {
		$employer_id = (int) get_post_meta( $post->ID, 'hr_employer_id', true );
		$company_name = get_post_meta( $post->ID, 'hr_company_name', true );
		$employers   = get_users( array( 'role' => HR_Ecosystem_Roles::ROLE_EMPLOYER, 'orderby' => 'display_name' ) );
		wp_nonce_field( 'hr_save_employer', 'hr_employer_nonce' );
		?>
		<p>
			<label for="hr_company_name">Company name:</label><br>
			<input type="text" name="hr_company_name" id="hr_company_name" value="<?php echo esc_attr( $company_name ); ?>" class="large-text" placeholder="Company or brand name" />
		</p>
		<p>
			<label for="hr_employer_id">Employer user:</label><br>
			<select name="hr_employer_id" id="hr_employer_id" style="width:100%;">
				<option value="0">— Not set (portal vacancy) —</option>
				<?php foreach ( $employers as $u ) : ?>
					<option value="<?php echo (int) $u->ID; ?>" <?php selected( $employer_id, $u->ID ); ?>>
						<?php echo esc_html( $u->display_name . ' (ID: ' . $u->ID . ')' ); ?>
					</option>
				<?php endforeach; ?>
			</select>
		</p>
		<?php
	}

	public function render_vacancy_skills_tags_meta_box( $post ) {
		$skills = get_post_meta( $post->ID, 'hr_skills_required', true );
		$tags   = get_post_meta( $post->ID, 'hr_tags', true );
		wp_nonce_field( 'hr_save_skills_tags', 'hr_skills_tags_nonce' );
		?>
		<p>
			<label for="hr_skills_required"><strong>Required skills:</strong></label><br>
			<input type="text" name="hr_skills_required" id="hr_skills_required" value="<?php echo esc_attr( $skills ); ?>" class="large-text" placeholder="PHP, React, English B2…" />
		</p>
		<p>
			<label for="hr_vacancy_tags"><strong>Vacancy tags:</strong></label><br>
			<input type="text" name="hr_vacancy_tags" id="hr_vacancy_tags" value="<?php echo esc_attr( $tags ); ?>" class="large-text" placeholder="remote, office, startup…" />
		</p>
		<?php
	}

	public function save_vacancy_employer( $post_id, $post ) {
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		if ( isset( $_POST['hr_employer_nonce'] ) && wp_verify_nonce( $_POST['hr_employer_nonce'], 'hr_save_employer' ) ) {
			$employer_id = isset( $_POST['hr_employer_id'] ) ? (int) $_POST['hr_employer_id'] : 0;
			update_post_meta( $post_id, 'hr_employer_id', $employer_id );
			if ( isset( $_POST['hr_company_name'] ) ) {
				update_post_meta( $post_id, 'hr_company_name', sanitize_text_field( $_POST['hr_company_name'] ) );
			}
		}
		if ( isset( $_POST['hr_skills_tags_nonce'] ) && wp_verify_nonce( $_POST['hr_skills_tags_nonce'], 'hr_save_skills_tags' ) ) {
			$skills = isset( $_POST['hr_skills_required'] ) ? sanitize_text_field( $_POST['hr_skills_required'] ) : '';
			$tags   = isset( $_POST['hr_vacancy_tags'] ) ? sanitize_text_field( $_POST['hr_vacancy_tags'] ) : '';
			update_post_meta( $post_id, 'hr_skills_required', $skills );
			update_post_meta( $post_id, 'hr_tags', $tags );
		}
	}

	/**
	 * Meta box for Match: status and "Approve (send to employer)" button.
	 */
	public function add_match_meta_box() {
		add_meta_box(
			'hr_match_status',
			'Match status',
			array( $this, 'render_match_status_meta_box' ),
			'hr_match',
			'normal',
			'high'
		);
	}

	public function render_match_status_meta_box( $post ) {
		$status = get_post_meta( $post->ID, 'hr_status', true ) ?: 'pending';
		$vacancy_id   = (int) get_post_meta( $post->ID, 'hr_vacancy_id', true );
		$candidate_id = (int) get_post_meta( $post->ID, 'hr_candidate_id', true );
		$vacancy = $vacancy_id ? get_post( $vacancy_id ) : null;
		$candidate = $candidate_id ? get_userdata( $candidate_id ) : null;
		wp_nonce_field( 'hr_save_match_status', 'hr_match_status_nonce' );
		?>
		<p><strong>Vacancy:</strong> <?php echo $vacancy ? esc_html( $vacancy->post_title ) : '—'; ?></p>
		<p><strong>Candidate:</strong> <?php echo $candidate ? esc_html( $candidate->display_name ) : '—'; ?></p>
		<p>
			<label for="hr_match_status"><strong>Status:</strong></label><br>
			<select name="hr_match_status" id="hr_match_status">
				<option value="pending" <?php selected( $status, 'pending' ); ?>>Pending (admin has not approved)</option>
				<option value="pending_employer" <?php selected( $status, 'pending_employer' ); ?>>Pending employer (sent to employer; they must approve in the app)</option>
				<option value="confirmed" <?php selected( $status, 'confirmed' ); ?>>Confirmed (visible to candidate and in Opened resumes)</option>
				<option value="rejected" <?php selected( $status, 'rejected' ); ?>>Rejected</option>
			</select>
		</p>
		<p class="description">To approve a match: set status to <strong>Pending employer</strong> and click Update. The employer will see it in the Mini App under "Pending my approval" and can then confirm or reject. Only after the employer confirms will the candidate see the match in "My matches".</p>
		<?php
	}

	public function save_match_status( $post_id, $post ) {
		if ( ! current_user_can( 'edit_post', $post_id ) || $post->post_type !== 'hr_match' ) {
			return;
		}
		if ( isset( $_POST['hr_match_status_nonce'] ) && wp_verify_nonce( $_POST['hr_match_status_nonce'], 'hr_save_match_status' ) ) {
			$status = isset( $_POST['hr_match_status'] ) ? sanitize_text_field( $_POST['hr_match_status'] ) : '';
			if ( in_array( $status, array( 'pending', 'pending_employer', 'confirmed', 'rejected' ), true ) ) {
				update_post_meta( $post_id, 'hr_status', $status );
			}
		}
	}

	public function render_ai_meta_box( $post ) {
		$api_key = get_option( 'hr_openai_api_key' );
		?>
		<?php if ( empty( $api_key ) ) : ?>
			<div class="notice notice-warning inline">
				<p><strong>⚠️ OpenAI API Key is not set!</strong> Go to <a href="<?php echo admin_url( 'admin.php?page=hr-ecosystem' ); ?>">plugin settings</a> and add the API key for AI parsing.</p>
			</div>
		<?php else : ?>
			<div class="notice notice-info inline">
				<p>✅ OpenAI API Key is set. Paste raw job description below and AI will generate title and structured description.</p>
			</div>
		<?php endif; ?>
		<p><strong>Paste raw job description:</strong></p>
		<textarea id="hr_raw_vacancy" style="width:100%; height:150px;" placeholder="Paste vacancy text from any source..."></textarea>
		<br><br>
		<button type="button" id="hr_ai_generate_btn" class="button button-primary" <?php echo empty( $api_key ) ? 'disabled' : ''; ?>>🤖 Process with AI</button>
		<span id="hr_ai_loading" style="display:none; margin-left: 10px; color: #0073aa;">⏳ Processing...</span>
		<?php
	}

	public function enqueue_scripts( $hook ) {
		if ( 'post.php' !== $hook && 'post-new.php' !== $hook ) {
			return;
		}

		global $post;
		if ( 'vacancy' !== $post->post_type ) {
			return;
		}

		wp_enqueue_script( 'hr-admin-js', HR_ECO_URL . 'assets/js/admin.js', array( 'jquery' ), '1.0', true );
		wp_localize_script( 'hr-admin-js', 'hr_vars', array(
			'ajax_url' => admin_url( 'admin-ajax.php' ),
			'nonce'    => wp_create_nonce( 'hr_ai_nonce' ),
		) );
	}

	/**
	 * AJAX Handler
	 */
	public function ajax_parse_vacancy() {
		check_ajax_referer( 'hr_ai_nonce', 'nonce' );

		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( 'Недостаточно прав для выполнения этого действия.' );
		}

		$raw_text = isset( $_POST['text'] ) ? sanitize_textarea_field( $_POST['text'] ) : '';

		if ( empty( trim( $raw_text ) ) ) {
			wp_send_json_error( 'Vacancy text cannot be empty.' );
		}

		// Check API key
		$api_key = get_option( 'hr_openai_api_key' );
		if ( empty( $api_key ) ) {
			wp_send_json_error( 'OpenAI API Key is not set. Go to plugin settings and add the key.' );
		}

		$ai = new HR_Ecosystem_OpenAI();
		$result = $ai->parse_vacancy( $raw_text );

		if ( is_wp_error( $result ) ) {
			$error_message = $result->get_error_message();
			// Translate common errors
			if ( strpos( $error_message, 'no_api_key' ) !== false ) {
				$error_message = 'OpenAI API Key is not set.';
			} elseif ( strpos( $error_message, 'Invalid API key' ) !== false || strpos( $error_message, '401' ) !== false ) {
				$error_message = 'Неверный OpenAI API Key. Проверьте ключ в настройках.';
			} elseif ( strpos( $error_message, 'rate limit' ) !== false ) {
				$error_message = 'Превышен лимит запросов к OpenAI API. Попробуйте позже.';
			}
			wp_send_json_error( $error_message );
		}

		// Validate result structure
		if ( ! is_array( $result ) || empty( $result['title'] ) || empty( $result['content'] ) ) {
			wp_send_json_error( 'AI вернул некорректный результат. Попробуйте еще раз.' );
		}

		wp_send_json_success( $result );
	}
}
