<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HR_Ecosystem_Auth {

	public function __construct() {
	}

	/**
	 * Get Bot Token from Settings
	 */
	private function get_bot_token() {
		return get_option( 'hr_telegram_bot_token' );
	}

	/**
	 * Validate Telegram WebApp Data
	 * @param string $init_data The raw initData string from Telegram
	 * @return array|false User data if valid, false otherwise
	 */
	public function validate_telegram_data( $init_data ) {
		$bot_token = $this->get_bot_token();
		
		if ( empty( $bot_token ) ) {
			return false; // Token not configured
		}

		if ( empty( $init_data ) ) {
			return false;
		}

		// Parse the query string
		parse_str( $init_data, $data );

		if ( ! isset( $data['hash'] ) ) {
			return false;
		}

		$hash = $data['hash'];
		unset( $data['hash'] );

		// Sort keys
		ksort( $data );

		// Create data check string
		$data_check_arr = [];
		foreach ( $data as $key => $value ) {
			$data_check_arr[] = $key . '=' . $value;
		}
		$data_check_string = implode( "\n", $data_check_arr );

		// HMAC calculation
		$secret_key = hash_hmac( 'sha256', $bot_token, 'WebAppData', true );
		$check_hash = hash_hmac( 'sha256', $data_check_string, $secret_key );

		if ( hash_equals( $hash, $check_hash ) ) {
			// Data is valid!
			// Check if data is outdated (optional, e.g., < 24h)
			if ( isset( $data['auth_date'] ) && ( time() - $data['auth_date'] > 86400 ) ) {
				return false; // Expired
			}
			
			return isset($data['user']) ? json_decode($data['user'], true) : true;
		}

		return false;
	}

	/**
	 * Login or Register user based on Telegram ID
	 */
	public function login_user( $tg_user ) {
		$tg_id = $tg_user['id'];
		
		// 1. Find user by meta 'telegram_id'
		$users = get_users( array(
			'meta_key'   => 'telegram_id',
			'meta_value' => $tg_id,
			'number'     => 1,
		) );

		if ( ! empty( $users ) ) {
			$user = $users[0];
			// Sync Telegram name on every login
			if ( ! empty( $tg_user['first_name'] ) || ! empty( $tg_user['last_name'] ) ) {
				$first = $tg_user['first_name'] ?? '';
				$last  = $tg_user['last_name'] ?? '';
				update_user_meta( $user->ID, 'first_name', $first );
				update_user_meta( $user->ID, 'last_name', $last );
				$display = trim( $first . ' ' . $last );
				if ( $display !== '' ) {
					wp_update_user( array( 'ID' => $user->ID, 'display_name' => $display ) );
				}
			}
		} else {
			// 2. Register new user
			$username = 'tg_' . $tg_id;
			$email    = $tg_id . '@telegram.user'; // Placeholder
			
			// Check if username exists (rare edge case)
			if ( username_exists( $username ) ) {
				$username .= '_' . wp_rand( 1000, 9999 );
			}

			$password = wp_generate_password();

			$user_id = wp_create_user( $username, $password, $email );
			
			if ( is_wp_error( $user_id ) ) {
				return $user_id;
			}

			$user = get_user_by( 'id', $user_id );
			
			// Save Telegram metadata
			update_user_meta( $user_id, 'telegram_id', $tg_id );
			update_user_meta( $user_id, 'first_name', $tg_user['first_name'] ?? '' );
			update_user_meta( $user_id, 'last_name', $tg_user['last_name'] ?? '' );
			$display = trim( ( $tg_user['first_name'] ?? '' ) . ' ' . ( $tg_user['last_name'] ?? '' ) );
			if ( $display !== '' ) {
				wp_update_user( array( 'ID' => $user_id, 'display_name' => $display ) );
			}
			// Default status
			update_user_meta( $user_id, 'hr_status', 'passive' );
			// Role: new user from Telegram = candidate (соискатель)
			$user->set_role( HR_Ecosystem_Roles::ROLE_CANDIDATE );
		}

		// 3. Set Auth Cookie
		wp_set_auth_cookie( $user->ID, true );
		wp_set_current_user( $user->ID );

		return array(
			'user_id' => $user->ID,
			'username' => $user->user_login,
			'roles'   => $user->roles,
			'nonce'   => wp_create_nonce( 'wp_rest' ), // Return nonce for subsequent API calls
		);
	}
}
