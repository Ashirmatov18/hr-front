<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HR_Ecosystem_Types {

	public function __construct() {
		add_action( 'init', array( $this, 'register_vacancy_cpt' ) );
		add_action( 'init', array( $this, 'register_resume_cpt' ) );
		add_action( 'init', array( $this, 'register_application_cpt' ) );
		add_action( 'init', array( $this, 'register_match_cpt' ) );
		add_action( 'init', array( $this, 'register_candidate_fields' ) );
		add_action( 'init', array( $this, 'register_employer_fields' ) );
		add_action( 'init', array( $this, 'register_vacancy_meta' ), 15 );
		add_action( 'init', array( $this, 'register_resume_meta' ), 15 );
		add_action( 'init', array( $this, 'register_application_meta' ), 15 );
		add_action( 'init', array( $this, 'register_match_meta' ), 15 );
		add_filter( 'map_meta_cap', array( $this, 'resume_map_meta_cap' ), 10, 4 );
		add_filter( 'map_meta_cap', array( $this, 'application_map_meta_cap' ), 10, 4 );
		add_filter( 'map_meta_cap', array( $this, 'match_map_meta_cap' ), 10, 4 );
	}

	/**
	 * 1. Register "Vacancy" Post Type
	 */
	public function register_vacancy_cpt() {
		$labels = array(
			'name'               => 'Vacancies',
			'singular_name'      => 'Vacancy',
			'menu_name'          => 'HR Vacancies',
			'add_new'            => 'Add vacancy',
			'add_new_item'       => 'Add new vacancy',
			'edit_item'          => 'Edit vacancy',
		);

		$args = array(
			'labels'              => $labels,
			'public'              => true,
			'show_in_rest'        => true, // Important for Mini App
			'menu_icon'           => 'dashicons-businessperson',
			'supports'            => array( 'title', 'editor', 'custom-fields', 'excerpt' ),
			'rewrite'             => array( 'slug' => 'vacancies' ),
			'taxonomies'          => array( 'vacancy_category' ),
		);

		register_post_type( 'vacancy', $args );

		// Register Taxonomy
		register_taxonomy( 'vacancy_category', 'vacancy', array(
			'labels' => array(
				'name' => 'Vacancy categories',
			),
			'hierarchical' => true,
			'show_in_rest' => true,
		) );
	}

	/**
	 * 1b. Резюме соискателя (CV) — один пост на пользователя, автор = соискатель
	 */
	public function register_resume_cpt() {
		$labels = array(
			'name'               => 'Resumes',
			'singular_name'      => 'Resume',
			'menu_name'          => 'Resumes (HR)',
			'add_new'            => 'Add resume',
			'add_new_item'       => 'Add resume',
			'edit_item'          => 'Edit resume',
		);
		$args = array(
			'labels'              => $labels,
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'menu_icon'           => 'dashicons-id',
			'menu_position'       => 51,
			'supports'            => array( 'title', 'editor', 'author' ),
			'capability_type'     => 'hr_resume',
			'map_meta_cap'        => true,
			'show_in_rest'        => true,
		);
		register_post_type( 'hr_resume', $args );
	}

	/**
	 * 1c. Отклик соискателя на вакансию (связь candidate ↔ vacancy)
	 */
	public function register_application_cpt() {
		$labels = array(
			'name'               => 'Applications',
			'singular_name'      => 'Application',
			'menu_name'          => 'Applications (HR)',
			'add_new'            => 'Add application',
			'edit_item'          => 'View application',
		);
		$args = array(
			'labels'             => $labels,
			'public'             => false,
			'show_ui'             => true,
			'show_in_menu'       => true,
			'menu_icon'          => 'dashicons-email-alt',
			'menu_position'      => 52,
			'supports'           => array( 'title', 'author' ),
			'capability_type'    => 'hr_application',
			'map_meta_cap'       => true,
			'show_in_rest'       => true,
		);
		register_post_type( 'hr_application', $args );
	}

	/**
	 * 1d. Мэтч — связь вакансия + соискатель (ручной или по AI), статус подтверждения
	 */
	public function register_match_cpt() {
		$labels = array(
			'name'               => 'Matches',
			'singular_name'      => 'Match',
			'menu_name'          => 'Matches (HR)',
			'add_new'            => 'Add match',
			'edit_item'          => 'Edit match',
		);
		$args = array(
			'labels'             => $labels,
			'public'             => false,
			'show_ui'            => true,
			'show_in_menu'       => true,
			'menu_icon'          => 'dashicons-yes-alt',
			'menu_position'      => 53,
			'supports'           => array( 'title' ),
			'capability_type'    => 'post',
			'capabilities'      => array( 'create_posts' => 'manage_options' ),
			'map_meta_cap'       => true,
			'show_in_rest'       => true,
		);
		register_post_type( 'hr_match', $args );
	}

	/**
	 * 2. Add extra fields to User Profile
	 */
	public function register_candidate_fields() {
		// Status: active_search, passive, not_looking
		register_meta( 'user', 'hr_status', array(
			'type'         => 'string',
			'description'  => 'Candidate Status',
			'single'       => true,
			'show_in_rest' => true,
			'auth_callback' => function() { return true; } // Allow updates via REST
		) );

		register_meta( 'user', 'linkedin_url', array(
			'type'         => 'string',
			'single'       => true,
			'show_in_rest' => true,
			'auth_callback' => function() { return true; }
		) );
		
		register_meta( 'user', 'telegram_id', array(
			'type'         => 'string',
			'single'       => true,
			'show_in_rest' => array(
				'schema' => array(
					'context' => array( 'view', 'edit' ),
				),
			),
			// Only allow admins or self to edit this via other means, mostly handled by auth class
			'auth_callback' => function() { return current_user_can( 'edit_users' ); } 
		) );

		register_meta( 'user', 'club_badge', array(
			'type'         => 'boolean',
			'single'       => true,
			'show_in_rest' => true,
			'auth_callback' => function() { return current_user_can( 'edit_users' ); } // Only admin can change badge
		) );
		// Этап 8: навыки и теги соискателя
		register_meta( 'user', 'hr_skills', array(
			'type'         => 'string',
			'description'  => 'Candidate skills (comma-separated or free text)',
			'single'       => true,
			'show_in_rest' => true,
			'auth_callback' => function() { return true; }
		) );
		register_meta( 'user', 'hr_tags', array(
			'type'         => 'string',
			'description'  => 'Candidate tags (comma-separated)',
			'single'       => true,
			'show_in_rest' => true,
			'auth_callback' => function() { return true; }
		) );
	}

	/**
	 * 3. Employer (работодатель) — доп. поля пользователя с ролью hr_employer
	 */
	public function register_employer_fields() {
		register_meta( 'user', 'hr_company_name', array(
			'type'          => 'string',
			'description'   => 'Company name (employer)',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function() { return true; }
		) );
		register_meta( 'user', 'hr_contact_email', array(
			'type'          => 'string',
			'description'   => 'Contact email (employer)',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function() { return true; }
		) );
		register_meta( 'user', 'hr_contact_phone', array(
			'type'          => 'string',
			'description'   => 'Contact phone (employer)',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function() { return true; }
		) );
	}

	/**
	 * 4. Vacancy — привязка к работодателю (кто создал/владелец вакансии)
	 */
	public function register_vacancy_meta() {
		register_post_meta( 'vacancy', 'hr_employer_id', array(
			'type'              => 'integer',
			'description'       => 'User ID of the employer who owns this vacancy',
			'single'            => true,
			'show_in_rest'      => true,
			'auth_callback'     => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			}
		) );
		// Этап 8: теги и требуемые навыки вакансии
		register_post_meta( 'vacancy', 'hr_skills_required', array(
			'type'              => 'string',
			'description'       => 'Required skills (comma-separated or free text)',
			'single'            => true,
			'show_in_rest'      => true,
			'auth_callback'     => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			}
		) );
		register_post_meta( 'vacancy', 'hr_tags', array(
			'type'              => 'string',
			'description'       => 'Vacancy tags (comma-separated)',
			'single'            => true,
			'show_in_rest'      => true,
			'auth_callback'     => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			}
		) );
		register_post_meta( 'vacancy', 'hr_company_name', array(
			'type'              => 'string',
			'description'       => 'Company name (for this vacancy)',
			'single'            => true,
			'show_in_rest'      => true,
			'auth_callback'     => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			}
		) );
	}

	/**
	 * 5. Резюме — вложение CV (ID вложения в медиабиблиотеке)
	 */
	public function register_resume_meta() {
		register_post_meta( 'hr_resume', 'hr_cv_attachment_id', array(
			'type'          => 'integer',
			'description'   => 'Attachment ID of uploaded CV file',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			}
		) );
	}

	/**
	 * 6. Отклик — вакансия и статус
	 */
	public function register_application_meta() {
		register_post_meta( 'hr_application', 'hr_vacancy_id', array(
			'type'          => 'integer',
			'description'   => 'Vacancy post ID',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			}
		) );
		register_post_meta( 'hr_application', 'hr_status', array(
			'type'          => 'string',
			'description'   => 'pending, viewed, matched',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			}
		) );
	}

	/**
	 * 7. Мэтч — вакансия, соискатель, работодатель, статус
	 */
	public function register_match_meta() {
		register_post_meta( 'hr_match', 'hr_vacancy_id', array(
			'type'          => 'integer',
			'description'   => 'Vacancy post ID',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'manage_options' );
			}
		) );
		register_post_meta( 'hr_match', 'hr_candidate_id', array(
			'type'          => 'integer',
			'description'   => 'User ID of candidate',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'manage_options' );
			}
		) );
		register_post_meta( 'hr_match', 'hr_employer_id', array(
			'type'          => 'integer',
			'description'   => 'User ID of employer (vacancy owner)',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'manage_options' );
			}
		) );
		register_post_meta( 'hr_match', 'hr_status', array(
			'type'          => 'string',
			'description'   => 'pending (admin not approved), pending_employer (waiting employer), confirmed, rejected',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'manage_options' );
			}
		) );
		register_post_meta( 'hr_match', 'hr_candidate_reaction', array(
			'type'          => 'string',
			'description'   => 'Candidate reaction: interested, not_interested, or empty',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function( $allowed, $meta_key, $post_id ) {
				$candidate_id = (int) get_post_meta( $post_id, 'hr_candidate_id', true );
				return current_user_can( 'manage_options' ) || ( $candidate_id && get_current_user_id() === $candidate_id );
			}
		) );
	}

	/**
	 * Разрешить автору и администратору открывать/редактировать/удалять резюме в админке.
	 */
	public function resume_map_meta_cap( $caps, $cap, $user_id, $args ) {
		if ( empty( $args[0] ) ) {
			return $caps;
		}
		$post = get_post( $args[0] );
		if ( ! $post || $post->post_type !== 'hr_resume' ) {
			return $caps;
		}
		$is_author = (int) $post->post_author === (int) $user_id;
		$is_admin  = user_can( $user_id, 'manage_options' );
		if ( ! $is_author && ! $is_admin ) {
			return $caps;
		}
		switch ( $cap ) {
			case 'edit_post':
			case 'edit_hr_resume':
				return array( $is_author ? 'edit_hr_resumes' : 'edit_others_hr_resumes' );
			case 'read_post':
			case 'read_hr_resume':
				return array( 'read_hr_resume' );
			case 'delete_post':
			case 'delete_hr_resume':
				return array( $is_author ? 'delete_hr_resume' : 'delete_others_hr_resumes' );
		}
		return $caps;
	}

	/**
	 * Права на отклики: автор (соискатель) и администратор.
	 */
	public function application_map_meta_cap( $caps, $cap, $user_id, $args ) {
		if ( empty( $args[0] ) ) {
			return $caps;
		}
		$post = get_post( $args[0] );
		if ( ! $post || $post->post_type !== 'hr_application' ) {
			return $caps;
		}
		$is_author = (int) $post->post_author === (int) $user_id;
		$is_admin  = user_can( $user_id, 'manage_options' );
		if ( ! $is_author && ! $is_admin ) {
			return $caps;
		}
		switch ( $cap ) {
			case 'edit_post':
			case 'edit_hr_application':
				return array( $is_author ? 'edit_hr_applications' : 'edit_others_hr_applications' );
			case 'read_post':
			case 'read_hr_application':
				return array( 'read_hr_application' );
			case 'delete_post':
			case 'delete_hr_application':
				return array( $is_author ? 'delete_hr_application' : 'delete_others_hr_applications' );
		}
		return $caps;
	}

	/**
	 * Мэтчи — только администратор.
	 */
	public function match_map_meta_cap( $caps, $cap, $user_id, $args ) {
		if ( empty( $args[0] ) ) {
			return $caps;
		}
		$post = get_post( $args[0] );
		if ( ! $post || $post->post_type !== 'hr_match' ) {
			return $caps;
		}
		if ( ! user_can( $user_id, 'manage_options' ) ) {
			return $caps;
		}
		switch ( $cap ) {
			case 'edit_post':
			case 'edit_hr_match':
				return array( 'exist' );
			case 'read_post':
			case 'read_hr_match':
				return array( 'exist' );
			case 'delete_post':
			case 'delete_hr_match':
				return array( 'exist' );
		}
		return $caps;
	}
}
