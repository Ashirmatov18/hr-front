<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * HR Ecosystem roles: candidate (соискатель), employer (работодатель).
 * Admin uses standard WordPress administrator role (web only).
 */
class HR_Ecosystem_Roles {

	const ROLE_CANDIDATE = 'hr_candidate';
	const ROLE_EMPLOYER  = 'hr_employer';

	public function __construct() {
		add_action( 'init', array( $this, 'register_roles' ), 5 );
		register_activation_hook( HR_ECO_PATH . 'hr-ecosystem.php', array( $this, 'activate_roles' ) );
		register_deactivation_hook( HR_ECO_PATH . 'hr-ecosystem.php', array( $this, 'deactivate_roles' ) );
	}

	/**
	 * Register custom roles (safe to call on every init).
	 */
	public function register_roles() {
		$subscriber = get_role( 'subscriber' );
		$capabilities = $subscriber ? $subscriber->capabilities : array( 'read' => true );

		// Соискатель — базовые права + создание/редактирование своего резюме + загрузка CV.
		if ( ! get_role( self::ROLE_CANDIDATE ) ) {
			$capabilities['upload_files']      = true;
			$capabilities['edit_hr_resumes']   = true;
			$capabilities['create_hr_resumes'] = true;
			$capabilities['read_hr_resume']    = true;
			$capabilities['edit_hr_resume']    = true;
			$capabilities['delete_hr_resume']  = true;
			$capabilities['publish_hr_resumes']   = true;
			$capabilities['edit_hr_applications'] = true;
			$capabilities['create_hr_applications'] = true;
			$capabilities['read_hr_application'] = true;
			$capabilities['edit_hr_application'] = true;
			$capabilities['delete_hr_application'] = true;
			$capabilities['publish_hr_applications'] = true;
			add_role(
				self::ROLE_CANDIDATE,
				__( 'Candidate (HR)', 'hr-ecosystem' ),
				$capabilities
			);
		} else {
			$role = get_role( self::ROLE_CANDIDATE );
			if ( $role && ! $role->has_cap( 'upload_files' ) ) {
				$role->add_cap( 'upload_files' );
			}
			if ( $role && ! $role->has_cap( 'create_hr_resumes' ) ) {
				$role->add_cap( 'edit_hr_resumes' );
				$role->add_cap( 'create_hr_resumes' );
				$role->add_cap( 'read_hr_resume' );
				$role->add_cap( 'edit_hr_resume' );
				$role->add_cap( 'delete_hr_resume' );
				$role->add_cap( 'publish_hr_resumes' );
			}
			if ( $role && ! $role->has_cap( 'create_hr_applications' ) ) {
				$role->add_cap( 'edit_hr_applications' );
				$role->add_cap( 'create_hr_applications' );
				$role->add_cap( 'read_hr_application' );
				$role->add_cap( 'edit_hr_application' );
				$role->add_cap( 'delete_hr_application' );
				$role->add_cap( 'publish_hr_applications' );
			}
		}

		// Работодатель — базовые права + загрузка файлов (вакансии, вложения).
		$employer_caps = $subscriber ? $subscriber->capabilities : array( 'read' => true );
		$employer_caps['upload_files'] = true;
		if ( ! get_role( self::ROLE_EMPLOYER ) ) {
			add_role(
				self::ROLE_EMPLOYER,
				__( 'Employer (HR)', 'hr-ecosystem' ),
				$employer_caps
			);
		} else {
			$emp_role = get_role( self::ROLE_EMPLOYER );
			if ( $emp_role && ! $emp_role->has_cap( 'upload_files' ) ) {
				$emp_role->add_cap( 'upload_files' );
			}
		}

		// Администратору — права на управление резюме в админке (чтобы можно было открывать и редактировать).
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			$admin->add_cap( 'edit_hr_resumes' );
			$admin->add_cap( 'edit_others_hr_resumes' );
			$admin->add_cap( 'create_hr_resumes' );
			$admin->add_cap( 'read_hr_resume' );
			$admin->add_cap( 'edit_hr_resume' );
			$admin->add_cap( 'delete_hr_resume' );
			$admin->add_cap( 'delete_others_hr_resumes' );
			$admin->add_cap( 'delete_hr_resumes' );
			$admin->add_cap( 'publish_hr_resumes' );
			$admin->add_cap( 'read_private_hr_resumes' );
			$admin->add_cap( 'edit_hr_applications' );
			$admin->add_cap( 'edit_others_hr_applications' );
			$admin->add_cap( 'create_hr_applications' );
			$admin->add_cap( 'read_hr_application' );
			$admin->add_cap( 'edit_hr_application' );
			$admin->add_cap( 'delete_hr_application' );
			$admin->add_cap( 'delete_others_hr_applications' );
			$admin->add_cap( 'publish_hr_applications' );
			$admin->add_cap( 'read_private_hr_applications' );
		}
	}

	public function activate_roles() {
		$this->register_roles();
		flush_rewrite_rules();
	}

	public function deactivate_roles() {
		remove_role( self::ROLE_CANDIDATE );
		remove_role( self::ROLE_EMPLOYER );
	}

	/**
	 * Check if user is candidate.
	 */
	public static function is_candidate( $user_id = 0 ) {
		$user_id = $user_id ? $user_id : get_current_user_id();
		$user = get_userdata( $user_id );
		return $user && in_array( self::ROLE_CANDIDATE, (array) $user->roles, true );
	}

	/**
	 * Check if user is employer.
	 */
	public static function is_employer( $user_id = 0 ) {
		$user_id = $user_id ? $user_id : get_current_user_id();
		$user = get_userdata( $user_id );
		return $user && in_array( self::ROLE_EMPLOYER, (array) $user->roles, true );
	}

	/**
	 * Check if user is admin (administrator or can manage_options).
	 */
	public static function is_admin( $user_id = 0 ) {
		$user_id = $user_id ? $user_id : get_current_user_id();
		return user_can( $user_id, 'manage_options' );
	}
}
