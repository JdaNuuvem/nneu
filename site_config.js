// =================================================================================
// CONFIGURAÇÃO DO SITE - PNEUS (checkout endereço → frete → pagamento → PIX)
// =================================================================================

var PRECO_PNEU = "99.90";
var PRECO_ORIGINAL = "588.90";
var SHIPPING_OPTIONS = [
    {
        id: "frete_gratis",
        company: "Frete Grátis",
        price: 0,
        daysMin: 1,
        daysMax: 5,
        logo: "../assets/shipping/ml_full.png",
        best_option: true
    }
];

// Lista de produtos (pneus por tamanho) - mesmo preço R$ 99,90
var TIRE_PRODUCTS = [
    { size: "175/75R13", image: "images/aro 13/175_75r13.png" },
    { size: "175/70R13", image: "images/aro 13/175_70r13.png" },
    { size: "175/60R13", image: "images/aro 13/175_60r13.png" },
    { size: "165/70R13", image: "images/aro 13/165_70r13.png" },
    { size: "175/80R14", image: "images/aro14/175_80r14.png" },
    { size: "175/75R14", image: "images/aro14/175_75r14.png" },
    { size: "175/70R14", image: "images/aro14/175_70r14.png" },
    { size: "175/65R14", image: "images/aro14/175_65r14.png" },
    { size: "185/70R14", image: "images/aro14/185_70r14.png" },
    { size: "185/65R14", image: "images/aro14/185_65r14.png" },
    { size: "195/60R15", image: "images/aro 15/195_60r15.png" },
    { size: "195/55R15", image: "images/aro 15/195_55r15.png" },
    { size: "185/65R15", image: "images/aro 15/185_65r15.png" },
    { size: "185/60R15", image: "images/aro 15/185_60r15.png" },
    { size: "215/65R16", image: "images/aro16/215_65r16.png" },
    { size: "205/60R16", image: "images/aro16/205_60r16.png" },
    { size: "205/55R16", image: "images/aro16/205_55r16.png" },
    { size: "185/55R16", image: "images/aro16/185_55r16.png" },
    { size: "225/65R17", image: "images/aro17/225_65r17.png" },
    { size: "215/60R17", image: "images/aro17/215_60r17.png" },
    { size: "215/50R17", image: "images/aro17/215_50r17.png" },
    { size: "205/55R17", image: "images/aro17/205_55r17.png" },
    { size: "205/50R17", image: "images/aro17/205_50r17.png" }
];

var SiteConfig = {
    siteName: "Mercado Livre - Pneus",
    products: [],
    product: null,
    shipping: SHIPPING_OPTIONS
};

// Montar products a partir dos tamanhos (id = size com / trocado por _)
TIRE_PRODUCTS.forEach(function(p) {
    var id = p.size.replace(/\//g, "_");
    SiteConfig.products.push({
        id: id,
        name: "Pneu " + p.size,
        priceOriginal: PRECO_ORIGINAL,
        priceCurrent: PRECO_PNEU,
        discount: "83%",
        daysToDelivery: 5,
        images: [p.image.indexOf("http") === 0 ? p.image : ("../" + p.image)],
        shipping: SHIPPING_OPTIONS
    });
});

// Produto padrão (primeiro) para quando não houver produto-id na URL
function getCurrentProduct() {
    var urlParams = new URLSearchParams(window.location.search);
    var productId = urlParams.get("produto-id");
    if (productId) {
        var found = SiteConfig.products.find(function(p) { return p.id === productId; });
        if (found) return found;
        // produto-id pode vir com / (ex: 175/70R13) em alguns casos
        var withSlash = productId.replace(/_/g, "/");
        found = SiteConfig.products.find(function(p) { return p.id === productId || p.name === "Pneu " + withSlash; });
        if (found) return found;
    }
    return SiteConfig.products[0] || null;
}

// Definir produto atual ao carregar (usado pelas páginas do checkout)
SiteConfig.product = getCurrentProduct();
if (!SiteConfig.product && SiteConfig.products.length) {
    SiteConfig.product = SiteConfig.products[0];
}
