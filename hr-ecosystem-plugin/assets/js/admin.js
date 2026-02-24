jQuery(document).ready(function($) {
    $('#hr_ai_generate_btn').on('click', function() {
        var rawText = $('#hr_raw_vacancy').val();
        
        if (!rawText || rawText.trim() === '') {
            alert('Пожалуйста, введите текст вакансии для обработки.');
            return;
        }

        $('#hr_ai_loading').show();
        $(this).prop('disabled', true);

        $.ajax({
            url: hr_vars.ajax_url,
            type: 'POST',
            data: {
                action: 'hr_parse_vacancy',
                nonce: hr_vars.nonce,
                text: rawText
            },
            success: function(response) {
                $('#hr_ai_loading').hide();
                $('#hr_ai_generate_btn').prop('disabled', false);

                if (response.success && response.data) {
                    var data = response.data;
                    
                    // 1. Set Title
                    // Gutenberg Editor
                    if (typeof wp !== 'undefined' && wp.data && wp.data.dispatch && wp.data.select('core/editor')) {
                        // Update title
                        wp.data.dispatch('core/editor').editPost({ title: data.title });
                        
                        // Convert HTML to blocks for content
                        if (data.content && typeof wp.blocks !== 'undefined') {
                            try {
                                // Try to parse HTML and convert to blocks
                                var blocks = wp.blocks.rawHandler({ 
                                    HTML: data.content 
                                });
                                if (blocks && blocks.length > 0) {
                                    wp.data.dispatch('core/editor').resetBlocks(blocks);
                                } else {
                                    // Fallback: insert as HTML block
                                    var htmlBlock = wp.blocks.createBlock('core/html', {
                                        content: data.content
                                    });
                                    wp.data.dispatch('core/editor').resetBlocks([htmlBlock]);
                                }
                            } catch(e) {
                                console.error('Error parsing blocks:', e);
                                // Fallback: insert as HTML block
                                var htmlBlock = wp.blocks.createBlock('core/html', {
                                    content: data.content
                                });
                                wp.data.dispatch('core/editor').resetBlocks([htmlBlock]);
                            }
                        }
                    } else {
                        // Classic Editor
                        $('#title').val(data.title);
                        if (typeof tinyMCE !== 'undefined' && tinyMCE.activeEditor && !tinyMCE.activeEditor.isHidden()) {
                            tinyMCE.activeEditor.setContent(data.content);
                        } else {
                            $('#content').val(data.content);
                        }
                    }
                    
                    alert('Вакансия успешно обработана! Проверьте заголовок и описание.');
                } else {
                    var errorMsg = response.data || 'Неизвестная ошибка';
                    alert('Ошибка: ' + errorMsg);
                    console.error('AI Parse Error:', response);
                }
            },
            error: function(xhr, status, error) {
                $('#hr_ai_loading').hide();
                $('#hr_ai_generate_btn').prop('disabled', false);
                var errorMsg = 'Ошибка соединения с сервером. ';
                if (xhr.responseJSON && xhr.responseJSON.data) {
                    errorMsg += xhr.responseJSON.data;
                } else {
                    errorMsg += error;
                }
                alert(errorMsg);
                console.error('AJAX Error:', xhr, status, error);
            }
        });
    });
});
