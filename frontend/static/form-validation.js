document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('form.needs-validation');

    forms.forEach((form) => {
        form.addEventListener('submit', (event) => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        });

        // Add real-time validation for specific fields
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                validateField(input);
            });
        });
    });
});

function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let message = '';

    switch (field.name) {
        case 'victim_id':
        case 'camp_id':
            if (!/^\d+$/.test(value)) {
                isValid = false;
                message = 'Must be a positive integer.';
            } else if (parseInt(value) <= 0) {
                isValid = false;
                message = 'Must be greater than 0.';
            }
            break;
        case 'name':
        case 'location':
            if (value.length < 2) {
                isValid = false;
                message = 'Must be at least 2 characters long.';
            } else if (!/^[a-zA-Z\s]+$/.test(value)) {
                isValid = false;
                message = 'Must contain only letters and spaces.';
            }
            break;
        case 'age':
            const age = parseInt(value);
            if (isNaN(age) || age < 0 || age > 150) {
                isValid = false;
                message = 'Must be between 0 and 150.';
            }
            break;
        case 'max_capacity':
        case 'food_packets':
        case 'medical_kits':
        case 'volunteers':
            const num = parseInt(value);
            if (isNaN(num) || num < 0) {
                isValid = false;
                message = 'Must be a non-negative integer.';
            }
            break;
        case 'health_condition':
            if (!['normal', 'critical'].includes(value.toLowerCase())) {
                isValid = false;
                message = 'Must be either "normal" or "critical".';
            }
            break;
    }

    field.classList.toggle('is-invalid', !isValid);
    field.classList.toggle('is-valid', isValid && value !== '');

    const feedback = field.parentNode.querySelector('.invalid-feedback');
    if (feedback) {
        feedback.textContent = message;
    }

    return isValid;
}
