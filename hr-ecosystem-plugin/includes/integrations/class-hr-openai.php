<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HR_Ecosystem_OpenAI {

	private $api_key;

	public function __construct() {
		$this->api_key = get_option( 'hr_openai_api_key' );
	}

	public function parse_vacancy( $raw_text ) {
		if ( empty( $this->api_key ) ) {
			return new WP_Error( 'no_api_key', 'OpenAI API Key is not configured.' );
		}

		$prompt = "You are an HR Assistant. Analyze the following raw job description. 
		1. Extract a clear, catchy Job Title.
		2. Format the description into clean HTML (using <h2>, <ul>, <p>, <strong>). 
		   - Structure it with sections: 'About', 'Responsibilities', 'Requirements', 'Conditions'.
		   - Remove any garbage text or duplicates.
		3. Extract required skills as a comma-separated string (e.g. 'PHP, React, SQL').
		4. Extract tags as a comma-separated string (e.g. 'remote, full-time').
		Return ONLY a JSON object with keys: 'title', 'content', 'skills_required', 'tags'. Do not use Markdown code blocks.";

		$body = array(
			'model' => 'gpt-4o-mini',
			'messages' => array(
				array( 'role' => 'system', 'content' => $prompt ),
				array( 'role' => 'user', 'content' => $raw_text ),
			),
			'response_format' => array( 'type' => 'json_object' ),
		);

		$response = wp_remote_post( 'https://api.openai.com/v1/chat/completions', array(
			'headers' => array(
				'Authorization' => 'Bearer ' . $this->api_key,
				'Content-Type'  => 'application/json',
			),
			'body'    => json_encode( $body ),
			'timeout' => 30,
		) );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$body_content = wp_remote_retrieve_body( $response );
		$data = json_decode( $body_content, true );

		if ( isset( $data['error'] ) ) {
			return new WP_Error( 'openai_error', $data['error']['message'] );
		}

		if ( isset( $data['choices'][0]['message']['content'] ) ) {
			return json_decode( $data['choices'][0]['message']['content'], true );
		}

		return new WP_Error( 'unknown_error', 'Unknown error from OpenAI' );
	}

	/**
	 * Generate resume title and content from a short prompt (e.g. "Frontend developer, 5 years React").
	 *
	 * @param string $prompt User prompt describing the candidate or desired resume.
	 * @return array|WP_Error Associative array with 'title' and 'content', or WP_Error.
	 */
	public function generate_resume( $prompt ) {
		if ( empty( $this->api_key ) ) {
			return new WP_Error( 'no_api_key', 'OpenAI API Key is not configured.' );
		}

		$system = "You are an HR Assistant. The user will give a short description (job title, experience, or skills). Generate a resume snippet: 1) A short professional title (e.g. 'Senior Frontend Developer'). 2) A few paragraphs of 'About' text suitable for a resume (experience, skills, what they are looking for). Return ONLY a JSON object with keys: 'title' and 'content'. No Markdown.";
		$body = array(
			'model' => 'gpt-4o-mini',
			'messages' => array(
				array( 'role' => 'system', 'content' => $system ),
				array( 'role' => 'user', 'content' => $prompt ?: 'Developer' ),
			),
			'response_format' => array( 'type' => 'json_object' ),
		);

		$response = wp_remote_post( 'https://api.openai.com/v1/chat/completions', array(
			'headers' => array(
				'Authorization' => 'Bearer ' . $this->api_key,
				'Content-Type'  => 'application/json',
			),
			'body'    => json_encode( $body ),
			'timeout' => 30,
		) );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$body_content = wp_remote_retrieve_body( $response );
		$data = json_decode( $body_content, true );

		if ( isset( $data['error'] ) ) {
			return new WP_Error( 'openai_error', $data['error']['message'] );
		}

		if ( isset( $data['choices'][0]['message']['content'] ) ) {
			return json_decode( $data['choices'][0]['message']['content'], true );
		}

		return new WP_Error( 'unknown_error', 'Unknown error from OpenAI' );
	}
}
