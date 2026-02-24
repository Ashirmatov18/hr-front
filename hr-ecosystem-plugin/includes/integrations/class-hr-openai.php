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
		3. Return ONLY a JSON object with keys: 'title' and 'content'. Do not use Markdown code blocks.";

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
}
