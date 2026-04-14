document.addEventListener('DOMContentLoaded', () => {
    const counterElements = document.querySelectorAll('.counter');

    const animateCounter = (element) => {
        const target = Number(element.dataset.target || 0);
        if (!target) {
            return;
        }

        const duration = 1100;
        const frameRate = 16;
        const totalFrames = Math.round(duration / frameRate);
        let frame = 0;

        const timer = setInterval(() => {
            frame += 1;
            const progress = frame / totalFrames;
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const value = Math.round(target * easedProgress);

            element.textContent = String(value);

            if (frame >= totalFrames) {
                element.textContent = String(target);
                clearInterval(timer);
            }
        }, frameRate);
    };

    const revealElements = document.querySelectorAll('.reveal-item');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        },
        {
            threshold: 0.2,
            rootMargin: '0px 0px -30px 0px'
        }
    );

    revealElements.forEach((element, index) => {
        element.style.transitionDelay = `${index * 90}ms`;
        observer.observe(element);
    });

    counterElements.forEach((counter) => {
        animateCounter(counter);
    });
});
