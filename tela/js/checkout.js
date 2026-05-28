const API_BASE = (() => {
    const path = window.location.pathname;
    if (path.indexOf('/tela/') !== -1) {
        return '../api/pix/index.php';
    }
    return '../api/pix/index.php';
})();

const Security = {
    sanitize: (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[&<>"'/]/g, (match) => {
            const escape = {
                '&': '&amp;', '<': '&lt;', '>': '&gt;',
                '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
            };
            return escape[match];
        }).trim();
    },

    validateCPF: (cpf) => {
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

        let add = 0;
        for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
        let rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(9))) return false;

        add = 0;
        for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
        rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        return rev === parseInt(cpf.charAt(10));
    }
};

const Toast = {
    container: null,
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    show(message, type = 'default') {
        this.init();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        this.container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

const storage = {
    get: (key) => JSON.parse(localStorage.getItem(key) || '{}'),
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    update: (key, val) => {
        const current = storage.get(key);
        Object.keys(val).forEach(k => {
            if (typeof val[k] === 'string') {
                val[k] = Security.sanitize(val[k]);
            }
        });
        storage.set(key, { ...current, ...val });
    }
};

const UI = {
    showError: (el, message) => {
        el.style.borderColor = '#ff0000';
        let err = el.parentNode.querySelector('.error-msg');
        if (!err) {
            err = document.createElement('span');
            err.className = 'error-msg';
            err.style.color = '#ff0000';
            err.style.fontSize = '12px';
            err.style.marginTop = '4px';
            err.style.display = 'block';
            el.parentNode.appendChild(err);
        }
        err.textContent = message;
    },
    clearError: (el) => {
        el.style.borderColor = '#ccc';
        const err = el.parentNode.querySelector('.error-msg');
        if (err) err.remove();
    },
    loading: (el, isLoading) => {
        if (isLoading) {
            el.disabled = true;
            el.dataset.originalText = el.textContent;
            el.textContent = 'Carregando...';
        } else {
            el.disabled = false;
            el.textContent = el.dataset.originalText || el.textContent;
        }
    }
};

const masks = {
    cpf: (v) => {
        v = v.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        return v.replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    },
    phone: (v) => {
        v = v.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        return v.replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .replace(/(-\d{4})\d+?$/, '$1');
    },
    cep: (v) => {
        v = v.replace(/\D/g, '');
        if (v.length > 8) v = v.slice(0, 8);
        return v.replace(/(\d{5})(\d)/, '$1-$2');
    },
    date: (v) => {
        v = v.replace(/\D/g, '');
        if (v.length > 8) v = v.slice(0, 8);
        return v.replace(/(\d{2})(\d)/, '$1/$2')
            .replace(/(\d{2})(\d)/, '$1/$2');
    }
};

const Masks = {
    apply: (el, maskName) => {
        if (!el) return;
        el.addEventListener('input', (e) => {
            const v = e.target.value;
            e.target.value = masks[maskName](v);
        });
    }
};

function initAddress() {
    const inputs = document.querySelectorAll('.form-input, .ml-input, .ml-select, .field-input, .field-textarea');

    const telInput = document.getElementById('telefone');
    if (telInput) Masks.apply(telInput, 'phone');

    const cepInput = document.getElementById('cep');
    if (cepInput) {
        Masks.apply(cepInput, 'cep');

        cepInput.addEventListener('blur', async () => {
            const cep = cepInput.value.replace(/\D/g, '');
            if (cep.length === 8) {
                try {
                    cepInput.style.opacity = '0.7';
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await res.json();

                    if (!data.erro) {
                        const setVal = (id, val) => {
                            const el = document.getElementById(id);
                            if (el) el.value = val;
                        };
                        setVal('logradouro', data.logradouro);
                        setVal('bairro', data.bairro);
                        setVal('cidade', data.localidade);
                        setVal('estado', data.uf);

                        const locationEl = document.getElementById('location-autofill');
                        const locationText = document.getElementById('location-text');
                        if (locationEl && locationText) {
                            locationText.textContent = `${data.uf}, ${data.localidade}, ${data.bairro}`;
                            locationEl.style.display = 'flex';
                        }

                        const numInput = document.getElementById('numero');
                        if (numInput) numInput.focus();
                        UI.clearError(cepInput);
                    } else {
                        Toast.show('CEP não encontrado.', 'error');
                        UI.showError(cepInput, 'CEP não encontrado.');
                        const locationEl = document.getElementById('location-autofill');
                        if (locationEl) locationEl.style.display = 'none';
                    }
                } catch (e) {
                    console.error(e);
                    Toast.show('Erro ao buscar CEP.', 'error');
                } finally {
                    cepInput.style.opacity = '1';
                }
            }
        });
    }

    const saved = storage.get('checkout_data');
    inputs.forEach(el => {
        if (saved[el.id]) el.value = saved[el.id];
    });

    const form = document.getElementById('form-address');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            let valid = true;

            if (telInput && telInput.value.length < 14) {
                UI.showError(telInput, 'Telefone inválido');
                valid = false;
            } else if (telInput) UI.clearError(telInput);

            if (cepInput && cepInput.value.length < 9) {
                UI.showError(cepInput, 'CEP incompleto');
                valid = false;
            } else if (cepInput) UI.clearError(cepInput);

            if (!valid) {
                Toast.show('Verifique os campos obrigatórios.', 'error');
                return;
            }

            const data = {};
            inputs.forEach(el => data[el.id] = el.value);
            storage.update('checkout_data', data);
            console.log("Redirecting to Shipping with params:", window.location.search);
            window.location.href = getUrlWithUtm('frete.html');
        });
    }
}

async function initPayment() {
    const addressData = storage.get('checkout_data');
    if (!addressData.cep) {
        window.location.href = getUrlWithUtm('endereco.html');
        return;
    }

    const cpfEl = document.getElementById('cpf');
    if (cpfEl) {
        Masks.apply(cpfEl, 'cpf');
        if (addressData.cpf && !cpfEl.value) cpfEl.value = addressData.cpf;
    }

    const emailEl = document.getElementById('email');
    if (emailEl && addressData.email && !emailEl.value) emailEl.value = addressData.email;

    const telefoneEl = document.getElementById('telefone');
    if (telefoneEl && addressData.telefone) {
        telefoneEl.value = masks.phone(addressData.telefone);
        Masks.apply(telefoneEl, 'phone');
    }

    const nameInput = document.getElementById('nome');
    const surnameInput = document.getElementById('sobrenome');

    if (nameInput && surnameInput) {
        if (addressData.nome) nameInput.value = addressData.nome;
        if (addressData.sobrenome) surnameInput.value = addressData.sobrenome;

        if (!nameInput.value && addressData.destinatario) {
            const parts = addressData.destinatario.trim().split(' ');
            if (parts.length > 0) {
                nameInput.value = parts[0];
                if (parts.length > 1) {
                    surnameInput.value = parts.slice(1).join(' ');
                }
            }
        }

        if (nameInput.value || surnameInput.value) {
            const newData = { ...addressData };
            if (nameInput.value) newData.nome = nameInput.value;
            if (surnameInput.value) newData.sobrenome = surnameInput.value;
            if (!newData.nome && !newData.sobrenome) { /* don't save empty */ }
            else { storage.set('checkout_data', newData); }
        }
    }

    const pixBtn = document.getElementById('btn-create-pix');
    if (pixBtn) {
        pixBtn.addEventListener('click', (e) => {
            e.preventDefault();

            const nameInput = document.getElementById('nome');
            const surnameInput = document.getElementById('sobrenome');
            const emailInput = document.getElementById('email');

            let valid = true;

            const rawCPF = cpfEl.value.replace(/\D/g, '');
            if (!Security.validateCPF(rawCPF)) {
                UI.showError(cpfEl, 'CPF inválido');
                valid = false;
            } else {
                UI.clearError(cpfEl);
            }

            const rawPhone = telefoneEl ? telefoneEl.value.replace(/\D/g, '') : '';
            if (rawPhone.length < 10 || rawPhone.length > 11) {
                UI.showError(telefoneEl, 'Telefone inválido');
                valid = false;
            } else {
                UI.clearError(telefoneEl);
            }

            if (Security.sanitize(nameInput.value).trim().length < 2) {
                UI.showError(nameInput, 'Nome obrigatório');
                valid = false;
            } else {
                UI.clearError(nameInput);
            }

            if (Security.sanitize(surnameInput.value).trim().length < 2) {
                UI.showError(surnameInput, 'Sobrenome obrigatório');
                valid = false;
            } else {
                UI.clearError(surnameInput);
            }

            const emailVal = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailVal || !emailRegex.test(emailVal)) {
                UI.showError(emailInput, 'Email inválido');
                valid = false;
            } else {
                UI.clearError(emailInput);
            }

            if (!valid) {
                Toast.show('Verifique os campos em vermelho.', 'error');
                return;
            }

            const currentData = storage.get('checkout_data');
            const newData = {
                ...currentData,
                nome: nameInput.value,
                sobrenome: surnameInput.value,
                email: emailInput.value,
                cpf: rawCPF,
                telefone: rawPhone
            };
            storage.set('checkout_data', newData);

            document.getElementById('step-nfe').classList.add('hidden');
            renderReviewScreen(newData);
        });
    }

    const confirmBtn = document.getElementById('btn-confirm-purchase');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            await createPixTransaction();
        });
    }
}

function renderReviewScreen(data) {
    const stepReview = document.getElementById('step-review');
    stepReview.classList.remove('hidden');
    window.scrollTo(0, 0);

    document.getElementById('billing-name').textContent = `${data.nome} ${data.sobrenome}`;
    document.getElementById('billing-cpf').textContent = `CPF ${masks.cpf(data.cpf)}`;

    const addressData = storage.get('checkout_data');
    const deliveryAddress = document.getElementById('delivery-address');
    if (deliveryAddress && addressData.logradouro) {
        deliveryAddress.innerHTML = `${addressData.logradouro} ${addressData.numero || ''}`;
    }

    const shippingData = storage.get('shipping_data') || {};
    const deliveryDate = document.getElementById('delivery-date');

    if (deliveryDate) {
        const daysToDelivery = (shippingData.daysMax || (typeof SiteConfig !== 'undefined' && SiteConfig.product ? SiteConfig.product.daysToDelivery : 3));
        const date = new Date();
        date.setDate(date.getDate() + parseInt(daysToDelivery));
        const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
        const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        deliveryDate.textContent = `Chegará entre ${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
    }

    const productPrice = parseFloat(typeof SiteConfig !== 'undefined' && SiteConfig?.product?.priceCurrent || 0);
    const shippingPrice = parseFloat(shippingData.price || 0);
    const total = productPrice + shippingPrice;

    const formatMoney = (val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    document.querySelectorAll('.dynamic-product-price').forEach(el => el.textContent = formatMoney(productPrice));

    const summaryShipping = document.getElementById('summary-shipping');
    if (summaryShipping) summaryShipping.textContent = shippingPrice === 0 ? 'Grátis' : formatMoney(shippingPrice);

    document.getElementById('summary-subtotal').textContent = formatMoney(total);
    document.getElementById('summary-total').textContent = formatMoney(total);

    document.querySelectorAll('.payment-total-display').forEach(el => el.textContent = formatMoney(total));
}

async function createPixTransaction() {
    const addressData = storage.get('checkout_data');
    const shippingData = storage.get('shipping_data');

    const productPrice = parseFloat(typeof SiteConfig !== 'undefined' && SiteConfig?.product?.priceCurrent || 0);
    const shippingPrice = parseFloat(shippingData.price || 0);
    const finalPrice = productPrice + shippingPrice;

    const fullName = `${addressData.nome} ${addressData.sobrenome}`;

    const payload = {
        value: finalPrice,
        name: fullName,
        document: addressData.cpf,
        email: addressData.email,
        phone: addressData.telefone,
        tracking: {
            src: new URLSearchParams(window.location.search).get('src'),
            sck: new URLSearchParams(window.location.search).get('sck'),
            utm_source: new URLSearchParams(window.location.search).get('utm_source'),
            utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
            utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
            utm_content: new URLSearchParams(window.location.search).get('utm_content'),
            utm_term: new URLSearchParams(window.location.search).get('utm_term')
        }
    };

    try {
        document.getElementById('step-review').classList.add('hidden');
        document.getElementById('step-loading').classList.remove('hidden');

        const res = await fetch(`${API_BASE}?action=create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Api-Key': '3f7a9c2b8d4e1f6a5b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8'
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        console.log('API Result', result);

        if (result.success && (result.pix_code || result.qr_code_base64)) {
            renderPixScreen({ ...result, amount: result.amount || finalPrice });
        } else {
            throw new Error(result.error || 'Erro ao gerar Pix');
        }
    } catch (err) {
        console.error(err);
        Toast.show('Erro: ' + err.message, 'error');
        document.getElementById('step-loading').classList.add('hidden');
        document.getElementById('step-review').classList.remove('hidden');
    }
}

function renderPixScreen(data) {
    document.getElementById('step-loading').classList.add('hidden');
    document.getElementById('step-pix').classList.remove('hidden');

    const copyCode = data.pix_code || "indisponivel";
    const qrImage = data.qr_code_base64 || 'https://via.placeholder.com/200?text=QR+Code+Erro';

    document.getElementById('pix-copypaste-input').textContent = copyCode;
    document.getElementById('pix-qrcode-img').src = qrImage;

    startTimer(1800);

    const copyBtn = document.getElementById('btn-copy-pix');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(copyCode);
            const original = copyBtn.innerHTML;
            copyBtn.textContent = "Copiado!";
            Toast.show('Código copiado!', 'success');
            setTimeout(() => copyBtn.innerHTML = original, 2000);
        };
    }

    const checkPaymentBtn = document.getElementById('btn-check-payment');
    let checkingPayment = false;

    if (checkPaymentBtn) {
        checkPaymentBtn.onclick = async () => {
            if (checkingPayment) return;

            checkingPayment = true;
            const msg = document.getElementById('check-status-msg');
            checkPaymentBtn.disabled = true;
            checkPaymentBtn.textContent = 'Verificando...';
            msg.textContent = '';
            msg.style.color = '#666';

            try {
                const res = await fetch(`${API_BASE}?action=status&external_id=${data.external_id}`, {
                    headers: {
                        'X-Api-Key': '3f7a9c2b8d4e1f6a5b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8'
                    }
                });
                const status = await res.json();

                if (status.paid && status.redirect_url) {
                    msg.textContent = '✓ Pagamento confirmado! Redirecionando...';
                    msg.style.color = '#28a745';
                    Toast.show('Pagamento confirmado!', 'success');
                    setTimeout(() => window.location.href = status.redirect_url, 1500);
                } else if (status.success) {
                    msg.textContent = '⏳ Ainda aguardando pagamento...';
                    msg.style.color = '#ffa500';
                } else {
                    msg.textContent = '❌ ' + (status.error || 'Erro ao verificar');
                    msg.style.color = '#f44336';
                }
            } catch (err) {
                msg.textContent = '❌ Erro de conexão. Tente novamente.';
                msg.style.color = '#f44336';
            }

            setTimeout(() => {
                checkPaymentBtn.disabled = false;
                checkPaymentBtn.textContent = 'Verificar pagamento';
                checkingPayment = false;
            }, 10000);
        };
    }

    if (data.external_id) {
        storage.set('pix_id', data.external_id);
        startPolling(data.external_id);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('pagamento.html')) {
        const savedId = storage.get('pix_id');

        if (savedId && typeof savedId === 'string') {
            startPolling(savedId);
        }

        const checkBtn = document.getElementById('btn-check-payment');
        if (checkBtn) {
            checkBtn.addEventListener('click', async () => {
                const extId = storage.get('pix_id');
                if (!extId) {
                    Toast.show('Nenhum pagamento encontrado.', 'error');
                    return;
                }

                checkBtn.disabled = true;
                checkBtn.textContent = 'Verificando...';

                try {
                    const res = await fetch(`${API_BASE}?action=status&external_id=${extId}`, {
                        headers: {
                            'X-Api-Key': '3f7a9c2b8d4e1f6a5b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8'
                        }
                    });
                    const data = await res.json();
                    if (data.paid) {
                        document.getElementById('check-status-msg').innerHTML = 'Pagamento confirmado! Redirecionando...';
                        Toast.show('Pagamento Confirmado!', 'success');
                        setTimeout(() => window.location.href = data.redirect_url, 2000);
                    } else if (data.error) {
                        Toast.show('Erro: ' + data.error, 'error');
                    } else {
                        Toast.show('Ainda aguardando pagamento...', 'default');
                    }
                } catch (e) {
                    console.error('Check error', e);
                    Toast.show('Erro ao verificar.', 'error');
                }

                setTimeout(() => {
                    checkBtn.disabled = false;
                    checkBtn.textContent = 'Já fiz o pagamento';
                }, 10000);
            });
        }
    }
});

function startTimer(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById('timer-display');
    const interval = setInterval(() => {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        if (display) display.textContent = minutes + ":" + seconds;
        if (--timer < 0) {
            clearInterval(interval);
            if (display) display.textContent = "EXPIRADO";
            Toast.show('O tempo expirou.', 'error');
            setTimeout(() => window.location.reload(), 2000);
        }
    }, 1000);
}

function checkStatus(id) {
    if (!id) return;
    fetch(`${API_BASE}?action=status&external_id=${id}`, {
        headers: {
            'X-Api-Key': '3f7a9c2b8d4e1f6a5b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8'
        }
    })
        .then(async r => {
            if (!r.ok) {
                const txt = await r.text();
                throw new Error(txt || `Erro ${r.status}`);
            }
            return r.json();
        })
        .then(status => {
            if (status.paid && status.redirect_url) {
                Toast.show('Pagamento Aprovado!', 'success');
                setTimeout(() => window.location.href = status.redirect_url, 1500);
            } else {
                Toast.show('Aguardando pagamento...', 'default');
            }
        }).catch(e => {
            console.error('Erro no status:', e);
            Toast.show('Não foi possível verificar o status.', 'error');
        });
}

function startPolling(id) {
    if (!id) return;
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}?action=status&external_id=${id}`, {
                headers: {
                    'X-Api-Key': '3f7a9c2b8d4e1f6a5b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8'
                }
            });
            if (!res.ok) return;

            const status = await res.json();
            if (status.paid && status.redirect_url) {
                clearInterval(interval);
                Toast.show('Pagamento Confirmado!', 'success');
                setTimeout(() => window.location.href = status.redirect_url, 1500);
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
    }, 60000);
}

const path = window.location.pathname;
if (path.includes('endereco.html')) initAddress();
if (path.includes('pagamento.html')) initPayment();

function initShipping() {
    const addressData = storage.get('checkout_data');
    if (!addressData.cep) {
        window.location.href = getUrlWithUtm('endereco.html');
        return;
    }

    const container = document.getElementById('shipping-options-container');
    if (!container) return;
    const btnContinue = document.getElementById('btn-continue-shipping');

    const productName = document.getElementById('product-name-mini');
    const productPrice = document.getElementById('product-price-mini');
    const productImg = document.getElementById('product-img-mini');

    if (typeof SiteConfig !== 'undefined') {
        if (productName) productName.textContent = SiteConfig.product.name;
        if (productPrice) productPrice.textContent = parseFloat(SiteConfig.product.priceCurrent).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (productImg && SiteConfig.product.images) productImg.src = SiteConfig.product.images[0];
    }

    const savedShipping = storage.get('shipping_data');
    let selectedOptionId = savedShipping.id || SiteConfig.shipping.find(s => s.best_option)?.id || SiteConfig.shipping[0].id;

    const renderOptions = () => {
        container.innerHTML = '';
        SiteConfig.shipping.forEach(option => {
            const isSelected = option.id === selectedOptionId;
            const priceText = option.price === 0 ? 'Grátis' : option.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const deliveryLabel = `Chega de ${option.daysMin} a ${option.daysMax} dias úteis`;

            const div = document.createElement('div');
            div.className = `shipping-option ${isSelected ? 'selected' : ''}`;
            div.onclick = () => selectOption(option.id);

            div.innerHTML = `
                <div class="shipping-radio ${isSelected ? 'active' : ''}" style="margin-right: 15px;"></div>
                <img src="${option.logo}" class="shipping-logo">
                <div class="shipping-details">
                    <span class="shipping-company">${option.company}</span>
                    <span class="shipping-info">${deliveryLabel}</span>
                    <span class="shipping-price ${option.price > 0 ? 'paid' : ''}">${priceText}</span>
                </div>
            `;
            container.appendChild(div);
        });
        updateSummary();
    };

    const selectOption = (id) => {
        selectedOptionId = id;
        renderOptions();
    };

    const updateSummary = () => {
        const option = SiteConfig.shipping.find(s => s.id === selectedOptionId);
        const productVal = parseFloat(SiteConfig.product.priceCurrent);
        const shippingVal = option.price;
        const totalVal = productVal + shippingVal;

        document.getElementById('summary-product-price').textContent = productVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('summary-shipping-price').textContent = shippingVal === 0 ? 'Grátis' : shippingVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('summary-total-price').textContent = totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    renderOptions();

    btnContinue.addEventListener('click', () => {
        const option = SiteConfig.shipping.find(s => s.id === selectedOptionId);

        storage.set('shipping_data', option);

        const productVal = parseFloat(SiteConfig.product.priceCurrent);
        const totalVal = productVal + option.price;

        localStorage.setItem('valor_total_carrinho', totalVal.toFixed(2));
        document.cookie = `valor_total_carrinho=${totalVal.toFixed(2)};path=/`;

        console.log("Redirecting to Payment with params:", window.location.search);
        window.location.href = getUrlWithUtm('pagamento.html');
    });
}

if (path.includes('frete.html')) initShipping();
