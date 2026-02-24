<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HR_Ecosystem_API {

	public function __construct() {
		add_filter( 'determine_current_user', array( $this, 'determine_current_user_from_cookie' ), 20 );
	}

	public function determine_current_user_from_cookie( $user_id ) {
		if ( $user_id ) {
			return $user_id;
		}

		if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
			return $user_id;
		}

		$cookie_value = null;
		if ( defined( 'LOGGED_IN_COOKIE' ) && ! empty( $_COOKIE[ LOGGED_IN_COOKIE ] ) ) {
			$cookie_value = $_COOKIE[ LOGGED_IN_COOKIE ];
		} else {
			foreach ( array_keys( $_COOKIE ) as $name ) {
				if ( strpos( $name, 'wordpress_logged_in_' ) === 0 ) {
					$cookie_value = $_COOKIE[ $name ];
					break;
				}
			}
		}

		if ( ! $cookie_value ) {
			return $user_id;
		}

		$user_id = wp_validate_logged_in_cookie( $cookie_value, 'logged_in' );

		return $user_id ? $user_id : 0;
	}

	public function register_routes() {
		$namespace = 'hr/v1';

		register_rest_route( $namespace, '/auth', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'auth_handler' ),
			'permission_callback' => '__return_true',
		) );

		// Dev only: get a Bearer token for current admin (for Mini App local testing with ?dev=1)
		register_rest_route( $namespace, '/dev-token', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'dev_token_handler' ),
			'permission_callback' => '__return_true',
		) );

		register_rest_route( $namespace, '/me', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_profile' ),
			'permission_callback' => '__return_true',
		) );

		register_rest_route( $namespace, '/me', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'update_profile' ),
			'permission_callback' => '__return_true',
		) );

		register_rest_route( $namespace, '/vacancies', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_vacancies' ),
			'permission_callback' => '__return_true',
		) );

		// Резюме соискателя: одно на пользователя
		register_rest_route( $namespace, '/resumes/me', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_my_resume' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( $namespace, '/resumes/me', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'upsert_my_resume' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( $namespace, '/resumes/me', array(
			'methods'             => 'DELETE',
			'callback'            => array( $this, 'delete_my_resume' ),
			'permission_callback' => '__return_true',
		) );

		// Отклик на вакансию
		register_rest_route( $namespace, '/vacancies/(?P<id>\\d+)/respond', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'respond_to_vacancy' ),
			'permission_callback' => '__return_true',
			'args'                => array( 'id' => array( 'required' => true, 'type' => 'integer', 'minimum' => 1 ) ),
		) );
		// Мои отклики
		register_rest_route( $namespace, '/applications/me', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_my_applications' ),
			'permission_callback' => '__return_true',
		) );

		// Работодатель: только свои вакансии
		register_rest_route( $namespace, '/vacancies/me', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_my_vacancies' ),
			'permission_callback' => '__return_true',
		) );
		// Работодатель: создать вакансию
		register_rest_route( $namespace, '/vacancies', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'create_vacancy' ),
			'permission_callback' => '__return_true',
		) );
		// Удалить свою вакансию (только автор или админ)
		register_rest_route( $namespace, '/vacancies/(?P<id>\\d+)', array(
			'methods'             => 'DELETE',
			'callback'            => array( $this, 'delete_vacancy' ),
			'permission_callback' => '__return_true',
			'args'                => array( 'id' => array( 'required' => true, 'type' => 'integer', 'minimum' => 1 ) ),
		) );
		// Работодатель: резюме, открытые по подтверждённым мэтчам (этап 6)
		register_rest_route( $namespace, '/resumes/opened', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_opened_resumes' ),
			'permission_callback' => '__return_true',
		) );
		// Работодатель/админ: список всех соискателей с резюме
		register_rest_route( $namespace, '/candidates', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_all_candidates' ),
			'permission_callback' => '__return_true',
		) );

		// Соискатель: мои мэтчи (этап 7)
		register_rest_route( $namespace, '/matches/me', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_my_matches' ),
			'permission_callback' => '__return_true',
		) );
		// Работодатель: мэтчи, ожидающие его одобрения (admin уже одобрил → pending_employer)
		register_rest_route( $namespace, '/matches/pending-approval', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_pending_approval_matches' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( $namespace, '/matches/(?P<id>\\d+)/reaction', array(
			'methods'             => 'PATCH',
			'callback'            => array( $this, 'set_match_reaction' ),
			'permission_callback' => '__return_true',
			'args'                => array( 'id' => array( 'required' => true, 'type' => 'integer', 'minimum' => 1 ) ),
		) );

		// Admin: match suggestions (applications without a match yet, with optional score) — stage 9
		register_rest_route( $namespace, '/matches/suggestions', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_match_suggestions' ),
			'permission_callback' => '__return_true',
		) );

		// Admin: matches — list, create, confirm/reject
		register_rest_route( $namespace, '/matches', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_matches' ),
			'permission_callback' => '__return_true',
			'args'                => array(
				'status' => array( 'type' => 'string', 'enum' => array( 'pending', 'pending_employer', 'confirmed', 'rejected' ) ),
			),
		) );
		register_rest_route( $namespace, '/matches', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'create_match' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( $namespace, '/matches/(?P<id>\\d+)', array(
			'methods'             => 'PATCH',
			'callback'            => array( $this, 'update_match_status' ),
			'permission_callback' => '__return_true',
			'args'                => array( 'id' => array( 'required' => true, 'type' => 'integer', 'minimum' => 1 ) ),
		) );

		// AI: parse raw vacancy text (title, content, skills, tags)
		register_rest_route( $namespace, '/ai/parse-vacancy', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'ai_parse_vacancy' ),
			'permission_callback' => array( $this, 'ensure_ai_user' ),
		) );
		// AI: generate resume title + content from prompt
		register_rest_route( $namespace, '/ai/generate-resume', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'ai_generate_resume' ),
			'permission_callback' => array( $this, 'ensure_ai_user' ),
		) );
	}

	private function ensure_current_user() {
		$user_id = get_current_user_id();
		if ( $user_id > 0 ) {
			return $user_id;
		}

		$auth_header = '';
		if ( isset( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
			$auth_header = $_SERVER['HTTP_AUTHORIZATION'];
		} elseif ( function_exists( 'apache_request_headers' ) ) {
			$headers     = apache_request_headers();
			$auth_header = $headers['Authorization'] ?? '';
		}

		if ( $auth_header && preg_match( '/Bearer\s+(.+)/i', $auth_header, $matches ) ) {
			$token      = sanitize_text_field( trim( $matches[1] ) );
			$user_query = new WP_User_Query( array(
				'meta_key'   => 'hr_auth_token',
				'meta_value' => hash( 'sha256', $token ),
				'number'     => 1,
			) );
			$users = $user_query->get_results();
			if ( ! empty( $users ) ) {
				$user_id = $users[0]->ID;
				wp_set_current_user( $user_id );
				return $user_id;
			}
		}

		return 0;
	}

	public function auth_handler( $request ) {
		$params    = $request->get_json_params();
		$init_data = isset( $params['initData'] ) ? $params['initData'] : '';

		if ( empty( $init_data ) ) {
			return new WP_Error( 'missing_init_data', 'initData is required.', array( 'status' => 400 ) );
		}

		$auth    = new HR_Ecosystem_Auth();
		$tg_user = $auth->validate_telegram_data( $init_data );

		if ( ! $tg_user ) {
			return new WP_Error( 'invalid_auth', 'Invalid Telegram Data.', array( 'status' => 403 ) );
		}

		$result = $auth->login_user( $tg_user );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$user_id = isset( $result['user_id'] ) ? (int) $result['user_id'] : 0;

		if ( $user_id > 0 ) {
			$plain_token     = bin2hex( random_bytes( 32 ) );
			update_user_meta( $user_id, 'hr_auth_token', hash( 'sha256', $plain_token ) );
			$result['token'] = $plain_token;
		}

		return rest_ensure_response( $result );
	}

	/**
	 * GET /dev-token — for local Mini App testing. Returns Bearer token for current admin (cookie auth).
	 */
	public function dev_token_handler( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'Log in to WordPress first (e.g. admin).', array( 'status' => 401 ) );
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'rest_forbidden', 'Admin only.', array( 'status' => 403 ) );
		}
		$plain_token = bin2hex( random_bytes( 32 ) );
		update_user_meta( $user_id, 'hr_auth_token', hash( 'sha256', $plain_token ) );
		return rest_ensure_response( array( 'token' => $plain_token ) );
	}

	public function get_profile( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}

		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return new WP_Error( 'rest_user_not_found', 'User not found.', array( 'status' => 404 ) );
		}

		$roles = (array) $user->roles;
		$hr_role = 'subscriber'; // default
		if ( in_array( HR_Ecosystem_Roles::ROLE_CANDIDATE, $roles, true ) ) {
			$hr_role = 'candidate';
		} elseif ( in_array( HR_Ecosystem_Roles::ROLE_EMPLOYER, $roles, true ) ) {
			$hr_role = 'employer';
		} elseif ( user_can( $user_id, 'manage_options' ) ) {
			$hr_role = 'admin';
		}

		return array(
			'id'           => $user_id,
			'first_name'   => $user->first_name ?: '',
			'last_name'    => $user->last_name  ?: '',
			'display_name' => $user->display_name ?: '',
			'role'         => $hr_role,
			'hr_status'    => get_user_meta( $user_id, 'hr_status',    true ) ?: 'passive',
			'linkedin_url' => get_user_meta( $user_id, 'linkedin_url', true ) ?: '',
			'club_badge'   => (bool) get_user_meta( $user_id, 'club_badge', true ),
			'hr_skills'    => get_user_meta( $user_id, 'hr_skills', true ) ?: '',
			'hr_tags'      => get_user_meta( $user_id, 'hr_tags', true ) ?: '',
		);
	}

	public function update_profile( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}

		$params = $request->get_json_params();

		if ( isset( $params['hr_status'] ) ) {
			$valid_statuses = array( 'active_search', 'passive', 'not_looking' );
			if ( in_array( $params['hr_status'], $valid_statuses, true ) ) {
				update_user_meta( $user_id, 'hr_status', sanitize_text_field( $params['hr_status'] ) );
			}
		}

		if ( isset( $params['linkedin_url'] ) ) {
			update_user_meta( $user_id, 'linkedin_url', esc_url_raw( $params['linkedin_url'] ) );
		}
		if ( array_key_exists( 'hr_skills', $params ) ) {
			update_user_meta( $user_id, 'hr_skills', sanitize_text_field( $params['hr_skills'] ) );
		}
		if ( array_key_exists( 'hr_tags', $params ) ) {
			update_user_meta( $user_id, 'hr_tags', sanitize_text_field( $params['hr_tags'] ) );
		}

		return $this->get_profile( $request );
	}

	public function get_vacancies( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}

		$has_badge = (bool) get_user_meta( $user_id, 'club_badge', true );

		$args = array(
			'post_type'      => 'vacancy',
			'posts_per_page' => 20,
			'post_status'    => 'publish',
		);

		if ( ! $has_badge ) {
			$args['tax_query'] = array(
				array(
					'taxonomy' => 'vacancy_category',
					'field'    => 'slug',
					'terms'    => 'public',
				),
			);
		}

		$query     = new WP_Query( $args );
		$vacancies = array();

		if ( $query->have_posts() ) {
			while ( $query->have_posts() ) {
				$query->the_post();
				$pid = get_the_ID();
				$vacancies[] = array(
					'id'               => $pid,
					'title'            => get_the_title(),
					'content'          => $this->strip_wp_block_comments( get_the_content() ),
					'excerpt'          => get_the_excerpt(),
					'date'             => get_the_date( 'c' ),
					'link'             => get_permalink(),
					'skills_required'  => get_post_meta( $pid, 'hr_skills_required', true ) ?: '',
					'tags'             => get_post_meta( $pid, 'hr_tags', true ) ?: '',
					'company_name'     => $this->get_vacancy_company_name( $pid ),
				);
			}
		}
		wp_reset_postdata();

		return $vacancies;
	}

	/**
	 * Remove Gutenberg block comments and return safe HTML for Mini App display.
	 *
	 * @param string $content Raw post content (may contain <!-- wp:... -->).
	 * @return string Safe HTML (block comments stripped, tags allowed for display).
	 */
	private function strip_wp_block_comments( $content ) {
		if ( ! is_string( $content ) ) {
			return '';
		}
		$content = preg_replace( '/<!--\s*wp:[\s\S]*?-->/', '', $content );
		$allowed = array(
			'p'      => array(),
			'h2'     => array( 'class' => array() ),
			'h3'     => array( 'class' => array() ),
			'h4'     => array( 'class' => array() ),
			'ul'     => array( 'class' => array() ),
			'ol'     => array( 'class' => array() ),
			'li'     => array(),
			'strong' => array(),
			'em'     => array(),
			'br'     => array(),
			'a'      => array( 'href' => array(), 'target' => array() ),
		);
		return wp_kses( $content, $allowed );
	}

	/**
	 * Company name for vacancy: from vacancy meta or employer profile.
	 */
	private function get_vacancy_company_name( $vacancy_id ) {
		$name = get_post_meta( $vacancy_id, 'hr_company_name', true );
		if ( $name ) {
			return $name;
		}
		$employer_id = (int) get_post_meta( $vacancy_id, 'hr_employer_id', true );
		if ( $employer_id ) {
			return get_user_meta( $employer_id, 'hr_company_name', true ) ?: '';
		}
		return '';
	}

	/**
	 * GET /vacancies/me — вакансии текущего работодателя (только свои)
	 */
	public function get_my_vacancies( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		if ( ! HR_Ecosystem_Roles::is_employer( $user_id ) && ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			return new WP_Error( 'rest_forbidden', 'Only employer or admin.', array( 'status' => 403 ) );
		}
		$query = new WP_Query( array(
			'post_type'      => 'vacancy',
			'post_status'    => 'publish',
			'posts_per_page' => 50,
			'orderby'        => 'date',
			'order'          => 'DESC',
			'meta_query'     => array(
				array( 'key' => 'hr_employer_id', 'value' => $user_id ),
			),
		) );
		$list = array();
		while ( $query->have_posts() ) {
			$query->the_post();
			$pid = get_the_ID();
			$list[] = array(
				'id'               => $pid,
				'title'            => get_the_title(),
				'content'          => $this->strip_wp_block_comments( get_the_content() ),
				'excerpt'          => get_the_excerpt(),
				'date'             => get_the_date( 'c' ),
				'link'             => get_permalink(),
				'skills_required'  => get_post_meta( $pid, 'hr_skills_required', true ) ?: '',
				'tags'             => get_post_meta( $pid, 'hr_tags', true ) ?: '',
				'company_name'     => $this->get_vacancy_company_name( $pid ),
			);
		}
		wp_reset_postdata();
		return rest_ensure_response( $list );
	}

	/**
	 * DELETE /vacancies/<id> — удалить свою вакансию (только автор или админ).
	 */
	public function delete_vacancy( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		$vacancy_id = (int) $request['id'];
		$vacancy = get_post( $vacancy_id );
		if ( ! $vacancy || $vacancy->post_type !== 'vacancy' ) {
			return new WP_Error( 'invalid_vacancy', 'Vacancy not found.', array( 'status' => 404 ) );
		}
		$employer_id = (int) get_post_meta( $vacancy_id, 'hr_employer_id', true );
		if ( $employer_id !== $user_id && ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			return new WP_Error( 'rest_forbidden', 'You can only delete your own vacancy.', array( 'status' => 403 ) );
		}
		wp_delete_post( $vacancy_id, true );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * POST /vacancies — создать вакансию (работодатель или админ)
	 * Body: title, content, excerpt (optional), category_ids (optional array of term IDs)
	 */
	public function create_vacancy( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		if ( ! HR_Ecosystem_Roles::is_employer( $user_id ) && ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			return new WP_Error( 'rest_forbidden', 'Only employer or admin can create vacancies.', array( 'status' => 403 ) );
		}
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = array();
		}
		$title = isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : '';
		if ( ! $title ) {
			return new WP_Error( 'missing_title', 'Title is required.', array( 'status' => 400 ) );
		}
		$content  = isset( $params['content'] ) ? wp_kses_post( $params['content'] ) : '';
		$excerpt  = isset( $params['excerpt'] ) ? sanitize_text_field( $params['excerpt'] ) : '';
		$cat_ids  = isset( $params['category_ids'] ) && is_array( $params['category_ids'] ) ? array_map( 'intval', $params['category_ids'] ) : array();
		$skills_required = isset( $params['skills_required'] ) ? sanitize_text_field( $params['skills_required'] ) : '';
		$tags_vacancy    = isset( $params['tags'] ) ? sanitize_text_field( $params['tags'] ) : '';
		$company_name   = isset( $params['company_name'] ) ? sanitize_text_field( $params['company_name'] ) : '';
		$post_id = wp_insert_post( array(
			'post_type'    => 'vacancy',
			'post_title'   => $title,
			'post_content' => $content,
			'post_excerpt' => $excerpt,
			'post_status'  => 'publish',
			'post_author'  => $user_id,
		) );
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		update_post_meta( $post_id, 'hr_employer_id', $user_id );
		update_post_meta( $post_id, 'hr_skills_required', $skills_required );
		update_post_meta( $post_id, 'hr_tags', $tags_vacancy );
		update_post_meta( $post_id, 'hr_company_name', $company_name );
		if ( ! empty( $cat_ids ) ) {
			wp_set_object_terms( $post_id, $cat_ids, 'vacancy_category' );
		}
		$post = get_post( $post_id );
		return rest_ensure_response( array(
			'id'               => (int) $post_id,
			'title'            => $post->post_title,
			'content'          => $this->strip_wp_block_comments( $post->post_content ),
			'excerpt'          => $post->post_excerpt,
			'date'             => get_the_date( 'c', $post ),
			'link'             => get_permalink( $post ),
			'skills_required'  => $skills_required,
			'tags'             => $tags_vacancy,
			'company_name'     => $company_name ? $company_name : $this->get_vacancy_company_name( $post_id ),
		) );
	}

	/**
	 * GET /resumes/opened — резюме соискателей, открытые работодателю по подтверждённым мэтчам (этап 6).
	 * Только работодатель или админ; возвращает список по своим подтверждённым мэтчам.
	 */
	public function get_opened_resumes( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		if ( ! HR_Ecosystem_Roles::is_employer( $user_id ) && ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			return new WP_Error( 'rest_forbidden', 'Only employer or admin.', array( 'status' => 403 ) );
		}
		$meta_query = array(
			array( 'key' => 'hr_status', 'value' => 'confirmed' ),
		);
		// Работодатель видит только свои мэтчи; админ — все подтверждённые
		if ( ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			$meta_query[] = array( 'key' => 'hr_employer_id', 'value' => $user_id );
		}
		$matches = get_posts( array(
			'post_type'      => 'hr_match',
			'post_status'    => 'any',
			'posts_per_page' => 100,
			'meta_query'     => $meta_query,
		) );
		$list = array();
		foreach ( $matches as $match_post ) {
			$vacancy_id   = (int) get_post_meta( $match_post->ID, 'hr_vacancy_id', true );
			$candidate_id = (int) get_post_meta( $match_post->ID, 'hr_candidate_id', true );
			$employer_id  = (int) get_post_meta( $match_post->ID, 'hr_employer_id', true );
			$vacancy = $vacancy_id ? get_post( $vacancy_id ) : null;
			$candidate = $candidate_id ? get_userdata( $candidate_id ) : null;
			$employer = $employer_id ? get_userdata( $employer_id ) : null;
			$resume_post = $this->get_resume_by_author( $candidate_id );
			$list[] = array(
				'match_id'         => (int) $match_post->ID,
				'employer_id'      => $employer_id,
				'employer_name'    => $employer ? $employer->display_name : '',
				'vacancy_id'       => $vacancy_id,
				'vacancy_title'    => $vacancy ? $vacancy->post_title : '',
				'vacancy_company_name' => $vacancy_id ? $this->get_vacancy_company_name( $vacancy_id ) : '',
				'candidate_id'     => $candidate_id,
				'candidate_name'   => $candidate ? $candidate->display_name : '',
				'candidate_skills' => $candidate_id ? get_user_meta( $candidate_id, 'hr_skills', true ) : '',
				'candidate_tags'   => $candidate_id ? get_user_meta( $candidate_id, 'hr_tags', true ) : '',
				'candidate_status' => $candidate_id ? get_user_meta( $candidate_id, 'hr_status', true ) : '',
				'resume'           => $resume_post ? $this->format_resume( $resume_post ) : null,
			);
		}
		return rest_ensure_response( $list );
	}

	/**
	 * GET /matches/pending-approval — мэтчи, ожидающие одобрения работодателя (status = pending_employer).
	 * После одобрения админом мэтч попадает сюда; работодатель одобряет → status = confirmed → соискатель видит в My matches.
	 */
	public function get_pending_approval_matches( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		if ( ! HR_Ecosystem_Roles::is_employer( $user_id ) && ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			return new WP_Error( 'rest_forbidden', 'Only employer or admin.', array( 'status' => 403 ) );
		}
		$meta_query = array(
			array( 'key' => 'hr_status', 'value' => 'pending_employer' ),
		);
		if ( ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			$meta_query[] = array( 'key' => 'hr_employer_id', 'value' => $user_id );
		}
		$matches = get_posts( array(
			'post_type'      => 'hr_match',
			'post_status'    => 'any',
			'posts_per_page' => 100,
			'orderby'        => 'date',
			'order'          => 'DESC',
			'meta_query'     => $meta_query,
		) );
		$list = array();
		foreach ( $matches as $match_post ) {
			$vacancy_id   = (int) get_post_meta( $match_post->ID, 'hr_vacancy_id', true );
			$candidate_id = (int) get_post_meta( $match_post->ID, 'hr_candidate_id', true );
			$vacancy = $vacancy_id ? get_post( $vacancy_id ) : null;
			$candidate = $candidate_id ? get_userdata( $candidate_id ) : null;
			$resume_post = $this->get_resume_by_author( $candidate_id );
			$list[] = array(
				'match_id'            => (int) $match_post->ID,
				'vacancy_id'          => $vacancy_id,
				'vacancy_title'       => $vacancy ? $vacancy->post_title : '',
				'vacancy_company_name'=> $vacancy_id ? $this->get_vacancy_company_name( $vacancy_id ) : '',
				'candidate_id'        => $candidate_id,
				'candidate_name'      => $candidate ? $candidate->display_name : '',
				'candidate_skills'    => $candidate_id ? get_user_meta( $candidate_id, 'hr_skills', true ) : '',
				'candidate_tags'      => $candidate_id ? get_user_meta( $candidate_id, 'hr_tags', true ) : '',
				'resume'              => $resume_post ? $this->format_resume( $resume_post ) : null,
			);
		}
		return rest_ensure_response( $list );
	}

	/**
	 * GET /candidates — список всех соискателей с резюме (работодатель или админ).
	 */
	public function get_all_candidates( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		if ( ! HR_Ecosystem_Roles::is_employer( $user_id ) && ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			return new WP_Error( 'rest_forbidden', 'Only employer or admin.', array( 'status' => 403 ) );
		}
		$users = get_users( array(
			'role'   => HR_Ecosystem_Roles::ROLE_CANDIDATE,
			'number' => 200,
			'orderby' => 'display_name',
		) );
		$list = array();
		foreach ( $users as $user ) {
			$resume_post = $this->get_resume_by_author( $user->ID );
			if ( ! $resume_post ) {
				continue; // только с резюме
			}
			$list[] = array(
				'candidate_id'     => $user->ID,
				'candidate_name'   => $user->display_name,
				'candidate_skills' => get_user_meta( $user->ID, 'hr_skills', true ) ?: '',
				'candidate_tags'   => get_user_meta( $user->ID, 'hr_tags', true ) ?: '',
				'candidate_status' => get_user_meta( $user->ID, 'hr_status', true ) ?: '',
				'resume'           => $this->format_resume( $resume_post ),
			);
		}
		return rest_ensure_response( $list );
	}

	/**
	 * GET /resumes/me — получить своё резюме (соискатель видит только своё)
	 */
	public function get_my_resume( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}

		$resume = $this->get_resume_by_author( $user_id );
		if ( ! $resume ) {
			return rest_ensure_response( array( 'resume' => null ) );
		}
		return rest_ensure_response( array( 'resume' => $this->format_resume( $resume ) ) );
	}

	/**
	 * POST /resumes/me — создать или обновить своё резюме
	 * Body: title (string), content (string), cv_attachment_id (int, optional)
	 */
	public function upsert_my_resume( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}

		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = array();
		}

		$title = isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : '';
		$content = isset( $params['content'] ) ? wp_kses_post( $params['content'] ) : '';
		$cv_attachment_id = isset( $params['cv_attachment_id'] ) ? (int) $params['cv_attachment_id'] : 0;

		$existing = $this->get_resume_by_author( $user_id );
		if ( $existing ) {
			wp_update_post( array(
				'ID'           => $existing->ID,
				'post_title'   => $title ? $title : $existing->post_title,
				'post_content' => $content !== '' ? $content : $existing->post_content,
				'post_status'  => 'publish',
			) );
			$post_id = $existing->ID;
		} else {
			$post_id = wp_insert_post( array(
				'post_type'    => 'hr_resume',
				'post_title'   => $title ? $title : __( 'My resume', 'hr-ecosystem' ),
				'post_content' => $content,
				'post_status'  => 'publish',
				'post_author'  => $user_id,
			) );
			if ( is_wp_error( $post_id ) ) {
				return $post_id;
			}
		}

		if ( $cv_attachment_id > 0 ) {
			update_post_meta( $post_id, 'hr_cv_attachment_id', $cv_attachment_id );
		}

		$resume = get_post( $post_id );
		return rest_ensure_response( array( 'resume' => $this->format_resume( $resume ) ) );
	}

	/**
	 * DELETE /resumes/me — удалить своё резюме.
	 */
	public function delete_my_resume( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		$existing = $this->get_resume_by_author( $user_id );
		if ( ! $existing ) {
			return new WP_Error( 'rest_not_found', 'No resume to delete.', array( 'status' => 404 ) );
		}
		wp_delete_post( $existing->ID, true );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * Найти резюме по автору (одно на пользователя)
	 */
	private function get_resume_by_author( $user_id ) {
		$posts = get_posts( array(
			'post_type'      => 'hr_resume',
			'post_status'    => 'publish',
			'author'         => $user_id,
			'posts_per_page' => 1,
		) );
		return isset( $posts[0] ) ? $posts[0] : null;
	}

	private function format_resume( $post ) {
		$cv_id = (int) get_post_meta( $post->ID, 'hr_cv_attachment_id', true );
		$cv_url = '';
		if ( $cv_id ) {
			$cv_url = wp_get_attachment_url( $cv_id );
		}
		return array(
			'id'                 => (int) $post->ID,
			'title'              => $post->post_title,
			'content'            => $post->post_content,
			'cv_attachment_id'   => $cv_id,
			'cv_url'             => $cv_url ? $cv_url : null,
			'updated_at'         => get_the_modified_date( 'c', $post ),
		);
	}

	/**
	 * POST /vacancies/<id>/respond — откликнуться на вакансию (один отклик на пару соискатель–вакансия)
	 */
	public function respond_to_vacancy( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		$vacancy_id = (int) $request['id'];
		$vacancy = get_post( $vacancy_id );
		if ( ! $vacancy || $vacancy->post_type !== 'vacancy' || $vacancy->post_status !== 'publish' ) {
			return new WP_Error( 'invalid_vacancy', 'Vacancy not found or not published.', array( 'status' => 404 ) );
		}
		$existing = $this->get_application_by_candidate_and_vacancy( $user_id, $vacancy_id );
		if ( $existing ) {
			return rest_ensure_response( $this->format_application( $existing ) );
		}
		$post_id = wp_insert_post( array(
			'post_type'   => 'hr_application',
			'post_title'  => sprintf( __( 'Application for "%s"', 'hr-ecosystem' ), $vacancy->post_title ),
			'post_status' => 'publish',
			'post_author' => $user_id,
		) );
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		update_post_meta( $post_id, 'hr_vacancy_id', $vacancy_id );
		update_post_meta( $post_id, 'hr_status', 'pending' );
		$app = get_post( $post_id );
		return rest_ensure_response( $this->format_application( $app ) );
	}

	/**
	 * GET /applications/me — список моих откликов
	 */
	public function get_my_applications( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		$posts = get_posts( array(
			'post_type'      => 'hr_application',
			'post_status'    => 'publish',
			'author'         => $user_id,
			'posts_per_page' => 50,
			'orderby'        => 'date',
			'order'          => 'DESC',
		) );
		$list = array();
		foreach ( $posts as $post ) {
			$list[] = $this->format_application( $post );
		}
		return rest_ensure_response( $list );
	}

	private function get_application_by_candidate_and_vacancy( $user_id, $vacancy_id ) {
		$posts = get_posts( array(
			'post_type'      => 'hr_application',
			'post_status'    => 'publish',
			'author'         => $user_id,
			'posts_per_page' => 1,
			'meta_query'     => array(
				array( 'key' => 'hr_vacancy_id', 'value' => $vacancy_id ),
			),
		) );
		return isset( $posts[0] ) ? $posts[0] : null;
	}

	private function format_application( $post ) {
		$vacancy_id = (int) get_post_meta( $post->ID, 'hr_vacancy_id', true );
		$status = get_post_meta( $post->ID, 'hr_status', true ) ?: 'pending';
		$vacancy = $vacancy_id ? get_post( $vacancy_id ) : null;
		return array(
			'id'          => (int) $post->ID,
			'vacancy_id'  => $vacancy_id,
			'vacancy_title' => $vacancy ? $vacancy->post_title : '',
			'status'      => $status,
			'created_at'  => get_the_date( 'c', $post ),
		);
	}

	/**
	 * GET /matches/suggestions — applications that don't have a match yet (admin). Optional match_score by skills/tags overlap. Stage 9.
	 */
	public function get_match_suggestions( $request ) {
		$check = $this->ensure_admin();
		if ( is_wp_error( $check ) ) {
			return $check;
		}
		$applications = get_posts( array(
			'post_type'      => 'hr_application',
			'post_status'    => 'publish',
			'posts_per_page' => 200,
			'orderby'        => 'date',
			'order'          => 'DESC',
		) );
		$list = array();
		foreach ( $applications as $app ) {
			$vacancy_id   = (int) get_post_meta( $app->ID, 'hr_vacancy_id', true );
			$candidate_id = (int) $app->post_author;
			if ( ! $vacancy_id || ! $candidate_id ) {
				continue;
			}
			if ( $this->get_match_by_vacancy_and_candidate( $vacancy_id, $candidate_id ) ) {
				continue; // already has a match
			}
			$vacancy   = get_post( $vacancy_id );
			$candidate = get_userdata( $candidate_id );
			$score     = $this->compute_match_score( $vacancy_id, $candidate_id );
			$list[] = array(
				'application_id'  => (int) $app->ID,
				'vacancy_id'       => $vacancy_id,
				'vacancy_title'    => $vacancy ? $vacancy->post_title : '',
				'candidate_id'     => $candidate_id,
				'candidate_name'   => $candidate ? $candidate->display_name : '',
				'match_score'      => $score,
				'application_date' => get_the_date( 'c', $app ),
			);
		}
		// Sort by score descending (best fit first)
		usort( $list, function( $a, $b ) {
			return ( $b['match_score'] - $a['match_score'] );
		} );
		return rest_ensure_response( $list );
	}

	/**
	 * Simple match score: number of matching words (skills + tags) between vacancy and candidate.
	 */
	private function compute_match_score( $vacancy_id, $candidate_id ) {
		$v_skills = get_post_meta( $vacancy_id, 'hr_skills_required', true ) ?: '';
		$v_tags   = get_post_meta( $vacancy_id, 'hr_tags', true ) ?: '';
		$c_skills = get_user_meta( $candidate_id, 'hr_skills', true ) ?: '';
		$c_tags   = get_user_meta( $candidate_id, 'hr_tags', true ) ?: '';
		$vacancy_words  = array_unique( array_filter( preg_split( '/[\s,;]+/', strtolower( $v_skills . ' ' . $v_tags ), -1, PREG_SPLIT_NO_EMPTY ) ) );
		$candidate_words = array_unique( array_filter( preg_split( '/[\s,;]+/', strtolower( $c_skills . ' ' . $c_tags ), -1, PREG_SPLIT_NO_EMPTY ) ) );
		return count( array_intersect( $vacancy_words, $candidate_words ) );
	}

	/**
	 * Admin only.
	 */
	private function ensure_admin() {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'rest_forbidden', 'Admin only.', array( 'status' => 403 ) );
		}
		return $user_id;
	}

	/**
	 * GET /matches — список мэтчей (админ), опционально ?status=pending|confirmed|rejected
	 */
	public function get_matches( $request ) {
		$check = $this->ensure_admin();
		if ( is_wp_error( $check ) ) {
			return $check;
		}
		$status_filter = $request->get_param( 'status' );
		$query = array(
			'post_type'      => 'hr_match',
			'post_status'    => 'any',
			'posts_per_page' => 100,
			'orderby'        => 'date',
			'order'          => 'DESC',
		);
		if ( $status_filter ) {
			$query['meta_query'] = array(
				array( 'key' => 'hr_status', 'value' => $status_filter ),
			);
		}
		$posts = get_posts( $query );
		$list = array();
		foreach ( $posts as $post ) {
			$list[] = $this->format_match( $post );
		}
		return rest_ensure_response( $list );
	}

	/**
	 * POST /matches — создать мэтч (админ). body: vacancy_id, candidate_id
	 */
	public function create_match( $request ) {
		$check = $this->ensure_admin();
		if ( is_wp_error( $check ) ) {
			return $check;
		}
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = array();
		}
		$vacancy_id   = isset( $params['vacancy_id'] ) ? (int) $params['vacancy_id'] : 0;
		$candidate_id = isset( $params['candidate_id'] ) ? (int) $params['candidate_id'] : 0;
		if ( ! $vacancy_id || ! $candidate_id ) {
			return new WP_Error( 'invalid_params', 'vacancy_id and candidate_id required.', array( 'status' => 400 ) );
		}
		$vacancy = get_post( $vacancy_id );
		if ( ! $vacancy || $vacancy->post_type !== 'vacancy' ) {
			return new WP_Error( 'invalid_vacancy', 'Vacancy not found.', array( 'status' => 404 ) );
		}
		$employer_id = (int) get_post_meta( $vacancy_id, 'hr_employer_id', true );
		$candidate = get_user_by( 'id', $candidate_id );
		if ( ! $candidate || ! get_userdata( $candidate_id ) ) {
			return new WP_Error( 'invalid_candidate', 'Candidate user not found.', array( 'status' => 404 ) );
		}
		$existing = $this->get_match_by_vacancy_and_candidate( $vacancy_id, $candidate_id );
		if ( $existing ) {
			return rest_ensure_response( $this->format_match( $existing ) );
		}
		$post_id = wp_insert_post( array(
			'post_type'   => 'hr_match',
			'post_title'  => sprintf( __( 'Match: %s — %s', 'hr-ecosystem' ), $vacancy->post_title, $candidate->display_name ),
			'post_status' => 'publish',
			'post_author' => 0,
		) );
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		update_post_meta( $post_id, 'hr_vacancy_id', $vacancy_id );
		update_post_meta( $post_id, 'hr_candidate_id', $candidate_id );
		update_post_meta( $post_id, 'hr_employer_id', $employer_id );
		update_post_meta( $post_id, 'hr_status', 'pending' );
		$match = get_post( $post_id );
		return rest_ensure_response( $this->format_match( $match ) );
	}

	/**
	 * PATCH /matches/<id> — статус мэтча.
	 * Админ: может выставить pending_employer (одобрить → отправить работодателю), confirmed, rejected.
	 * Работодатель: может выставить только confirmed или rejected для своих мэтчей со статусом pending_employer.
	 */
	public function update_match_status( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		$match_id = (int) $request['id'];
		$match = get_post( $match_id );
		if ( ! $match || $match->post_type !== 'hr_match' ) {
			return new WP_Error( 'invalid_match', 'Match not found.', array( 'status' => 404 ) );
		}
		$employer_id   = (int) get_post_meta( $match_id, 'hr_employer_id', true );
		$current_status = get_post_meta( $match_id, 'hr_status', true ) ?: 'pending';
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = array();
		}
		$new_status = isset( $params['status'] ) ? sanitize_text_field( $params['status'] ) : '';
		$allowed_admin = array( 'pending_employer', 'confirmed', 'rejected' );
		$allowed_employer = array( 'confirmed', 'rejected' );
		$is_admin = current_user_can( 'manage_options' );
		$is_employer_of_match = ( $employer_id === $user_id );
		if ( $is_admin && in_array( $new_status, $allowed_admin, true ) ) {
			// Admin: set any of pending_employer, confirmed, rejected
		} elseif ( $is_employer_of_match && $current_status === 'pending_employer' && in_array( $new_status, $allowed_employer, true ) ) {
			// Employer: can only confirm/reject when status is pending_employer
		} else {
			return new WP_Error( 'rest_forbidden', 'You cannot change this match status.', array( 'status' => 403 ) );
		}
		if ( ! in_array( $new_status, array( 'pending_employer', 'confirmed', 'rejected' ), true ) ) {
			return new WP_Error( 'invalid_status', 'status must be pending_employer, confirmed or rejected.', array( 'status' => 400 ) );
		}
		update_post_meta( $match_id, 'hr_status', $new_status );
		if ( $new_status === 'confirmed' ) {
			$vacancy_id   = (int) get_post_meta( $match_id, 'hr_vacancy_id', true );
			$candidate_id = (int) get_post_meta( $match_id, 'hr_candidate_id', true );
			$app = $this->get_application_by_candidate_and_vacancy( $candidate_id, $vacancy_id );
			if ( $app ) {
				update_post_meta( $app->ID, 'hr_status', 'matched' );
			}
		}
		$match = get_post( $match_id );
		return rest_ensure_response( $this->format_match( $match ) );
	}

	private function get_match_by_vacancy_and_candidate( $vacancy_id, $candidate_id ) {
		$posts = get_posts( array(
			'post_type'      => 'hr_match',
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'meta_query'     => array(
				array( 'key' => 'hr_vacancy_id', 'value' => $vacancy_id ),
				array( 'key' => 'hr_candidate_id', 'value' => $candidate_id ),
			),
		) );
		return isset( $posts[0] ) ? $posts[0] : null;
	}

	private function format_match( $post ) {
		$vacancy_id   = (int) get_post_meta( $post->ID, 'hr_vacancy_id', true );
		$candidate_id = (int) get_post_meta( $post->ID, 'hr_candidate_id', true );
		$employer_id  = (int) get_post_meta( $post->ID, 'hr_employer_id', true );
		$status       = get_post_meta( $post->ID, 'hr_status', true ) ?: 'pending';
		$reaction     = get_post_meta( $post->ID, 'hr_candidate_reaction', true ) ?: '';
		$vacancy = $vacancy_id ? get_post( $vacancy_id ) : null;
		$candidate = $candidate_id ? get_userdata( $candidate_id ) : null;
		$employer = $employer_id ? get_userdata( $employer_id ) : null;
		return array(
			'id'              => (int) $post->ID,
			'vacancy_id'      => $vacancy_id,
			'vacancy_title'   => $vacancy ? $vacancy->post_title : '',
			'candidate_id'    => $candidate_id,
			'candidate_name'  => $candidate ? $candidate->display_name : '',
			'employer_id'     => $employer_id,
			'employer_name'   => $employer ? $employer->display_name : '',
			'status'          => $status,
			'reaction'        => $reaction,
			'created_at'      => get_the_date( 'c', $post ),
		);
	}

	/**
	 * GET /matches/me — мэтчи текущего соискателя (этап 7)
	 */
	public function get_my_matches( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		if ( ! HR_Ecosystem_Roles::is_candidate( $user_id ) && ! HR_Ecosystem_Roles::is_admin( $user_id ) ) {
			return new WP_Error( 'rest_forbidden', 'Only candidate or admin.', array( 'status' => 403 ) );
		}
		$posts = get_posts( array(
			'post_type'      => 'hr_match',
			'post_status'    => 'any',
			'posts_per_page' => 50,
			'orderby'        => 'date',
			'order'          => 'DESC',
			'meta_query'     => array(
				array( 'key' => 'hr_candidate_id', 'value' => $user_id ),
				array( 'key' => 'hr_status', 'value' => 'confirmed' ),
			),
		) );
		$list = array();
		foreach ( $posts as $post ) {
			$list[] = $this->format_match( $post );
		}
		return rest_ensure_response( $list );
	}

	/**
	 * PATCH /matches/<id>/reaction — реакция соискателя на мэтч (этап 7). body: reaction = "interested" | "not_interested" | ""
	 */
	public function set_match_reaction( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		$match_id = (int) $request['id'];
		$match = get_post( $match_id );
		if ( ! $match || $match->post_type !== 'hr_match' ) {
			return new WP_Error( 'invalid_match', 'Match not found.', array( 'status' => 404 ) );
		}
		$candidate_id = (int) get_post_meta( $match_id, 'hr_candidate_id', true );
		if ( $candidate_id !== $user_id && ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'rest_forbidden', 'Only the candidate of this match can set reaction.', array( 'status' => 403 ) );
		}
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = array();
		}
		$reaction = isset( $params['reaction'] ) ? sanitize_text_field( $params['reaction'] ) : '';
		$allowed = array( 'interested', 'not_interested', '' );
		if ( ! in_array( $reaction, $allowed, true ) ) {
			return new WP_Error( 'invalid_reaction', 'reaction must be interested, not_interested, or empty string.', array( 'status' => 400 ) );
		}
		update_post_meta( $match_id, 'hr_candidate_reaction', $reaction );
		$match = get_post( $match_id );
		return rest_ensure_response( $this->format_match( $match ) );
	}

	/**
	 * Permission callback for AI routes: user must be logged in.
	 */
	public function ensure_ai_user( $request ) {
		$user_id = $this->ensure_current_user();
		if ( $user_id === 0 ) {
			return new WP_Error( 'rest_not_logged_in', 'User is not logged in.', array( 'status' => 401 ) );
		}
		return true;
	}

	/**
	 * POST /ai/parse-vacancy — body: raw_text. Returns title, content, skills_required, tags.
	 */
	public function ai_parse_vacancy( $request ) {
		$params = $request->get_json_params();
		$raw_text = isset( $params['raw_text'] ) ? sanitize_textarea_field( $params['raw_text'] ) : '';
		if ( empty( trim( $raw_text ) ) ) {
			return new WP_Error( 'missing_raw_text', 'raw_text is required.', array( 'status' => 400 ) );
		}
		$ai = new HR_Ecosystem_OpenAI();
		$result = $ai->parse_vacancy( $raw_text );
		if ( is_wp_error( $result ) ) {
			return new WP_Error( 'ai_error', $result->get_error_message(), array( 'status' => 502 ) );
		}
		if ( ! is_array( $result ) ) {
			return new WP_Error( 'ai_error', 'Invalid AI response.', array( 'status' => 502 ) );
		}
		$out = array(
			'title'            => isset( $result['title'] ) ? $result['title'] : '',
			'content'          => isset( $result['content'] ) ? $result['content'] : '',
			'skills_required'  => isset( $result['skills_required'] ) ? $result['skills_required'] : '',
			'tags'             => isset( $result['tags'] ) ? $result['tags'] : '',
		);
		return rest_ensure_response( $out );
	}

	/**
	 * POST /ai/generate-resume — body: prompt. Returns title, content.
	 */
	public function ai_generate_resume( $request ) {
		$params = $request->get_json_params();
		$prompt = isset( $params['prompt'] ) ? sanitize_textarea_field( $params['prompt'] ) : '';
		$ai = new HR_Ecosystem_OpenAI();
		$result = $ai->generate_resume( $prompt );
		if ( is_wp_error( $result ) ) {
			return new WP_Error( 'ai_error', $result->get_error_message(), array( 'status' => 502 ) );
		}
		if ( ! is_array( $result ) ) {
			return new WP_Error( 'ai_error', 'Invalid AI response.', array( 'status' => 502 ) );
		}
		$out = array(
			'title'   => isset( $result['title'] ) ? $result['title'] : '',
			'content' => isset( $result['content'] ) ? $result['content'] : '',
		);
		return rest_ensure_response( $out );
	}
}
