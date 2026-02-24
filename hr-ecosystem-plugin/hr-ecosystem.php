<?php
/**
 * Plugin Name: HR Ecosystem for Telegram
 * Description: Backend logic for Club HR Telegram Mini App. Handles auth, vacancies, and API.
 * Version: 1.0.0
 * Author: Trae AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'HR_ECO_PATH', plugin_dir_path( __FILE__ ) );
define( 'HR_ECO_URL', plugin_dir_url( __FILE__ ) );

require_once HR_ECO_PATH . 'includes/class-hr-roles.php';
require_once HR_ECO_PATH . 'includes/class-hr-types.php';
require_once HR_ECO_PATH . 'includes/class-hr-auth.php';
require_once HR_ECO_PATH . 'includes/api/class-hr-api.php';
require_once HR_ECO_PATH . 'includes/integrations/class-hr-openai.php';
require_once HR_ECO_PATH . 'includes/class-hr-admin.php';

class HR_Ecosystem {

	public function __construct() {
		add_filter( 'determine_current_user', array( $this, 'rest_api_cookie_auth_user' ), 20 );
		add_filter( 'rest_authentication_errors', array( $this, 'rest_api_allow_cookie_auth' ), 999 );
		add_filter( 'rest_pre_serve_request', array( $this, 'rest_cors_headers' ), 10, 4 );
		add_action( 'init', array( $this, 'rest_cors_preflight' ), 1 );

		new HR_Ecosystem_Roles();
		new HR_Ecosystem_Types();

		add_action( 'rest_api_init', array( $this, 'register_api_routes' ) );

		if ( is_admin() ) {
			new HR_Ecosystem_Admin();
		}
	}

	/**
	 * Устанавливаем пользователя из куки до того как WordPress проверит nonce.
	 */
	public function rest_api_cookie_auth_user( $user_id ) {
		if ( $user_id > 0 ) {
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

		if ( $cookie_value ) {
			$valid_id = wp_validate_logged_in_cookie( $cookie_value, 'logged_in' );
			if ( $valid_id ) {
				return $valid_id;
			}
		}

		// Bearer token (Mini App): so wp/v2/media and other REST work with HR token
		$auth_header = isset( $_SERVER['HTTP_AUTHORIZATION'] ) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
		if ( ! $auth_header && function_exists( 'apache_request_headers' ) ) {
			$headers = apache_request_headers();
			$auth_header = isset( $headers['Authorization'] ) ? $headers['Authorization'] : '';
		}
		// Fallback: некоторые хостинги обрезают Authorization — принимаем X-HR-Token: <token>
		if ( ( ! $auth_header || $auth_header === '' ) && ! empty( $_SERVER['HTTP_X_HR_TOKEN'] ) ) {
			$auth_header = 'Bearer ' . trim( $_SERVER['HTTP_X_HR_TOKEN'] );
		}
		if ( $auth_header && preg_match( '/Bearer\s+(.+)/i', $auth_header, $m ) ) {
			$token = sanitize_text_field( trim( $m[1] ) );
			$users = get_users( array(
				'meta_key'   => 'hr_auth_token',
				'meta_value' => hash( 'sha256', $token ),
				'number'     => 1,
			) );
			if ( ! empty( $users ) ) {
				wp_set_current_user( $users[0]->ID );
				return $users[0]->ID;
			}
		}

		return $user_id;
	}

	/**
	 * Если пользователь уже определён через куку — сбрасываем ошибку отсутствия nonce.
	 * Возвращаем null = "аутентификация прошла, ошибок нет".
	 */
	public function rest_api_allow_cookie_auth( $result ) {
		if ( $result === true || is_wp_error( $result ) ) {
			if ( get_current_user_id() > 0 ) {
				return null;
			}
		}

		return $result;
	}

	/**
	 * CORS preflight: respond to OPTIONS for HR namespace.
	 */
	public function rest_cors_preflight() {
		if ( $_SERVER['REQUEST_METHOD'] !== 'OPTIONS' ) {
			return;
		}
		$path = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		if ( strpos( $path, '/wp-json/hr/' ) === false ) {
			return;
		}
		$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? sanitize_text_field( $_SERVER['HTTP_ORIGIN'] ) : '';
		if ( $origin ) {
			header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
		} else {
			header( 'Access-Control-Allow-Origin: *' );
		}
		header( 'Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS' );
		header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-HR-Token, ngrok-skip-browser-warning' );
		header( 'Access-Control-Max-Age: 86400' );
		exit( 0 );
	}

	/**
	 * CORS headers for HR API (Mini App may be on another domain).
	 */
	public function rest_cors_headers( $served, $result, $request, $server ) {
		if ( $request->get_route() && strpos( $request->get_route(), '/hr/' ) === 0 ) {
			$origin = $request->get_header( 'Origin' );
			if ( $origin ) {
				header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
			} else {
				header( 'Access-Control-Allow-Origin: *' );
			}
			header( 'Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS' );
			header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-HR-Token, ngrok-skip-browser-warning' );
			header( 'Access-Control-Allow-Credentials: false' );
		}
		return $served;
	}

	public function register_api_routes() {
		$api = new HR_Ecosystem_API();
		$api->register_routes();
	}
}

new HR_Ecosystem();