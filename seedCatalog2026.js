const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Category = require('./src/modules/categores/model');
const Product = require('./src/modules/products/model');

// Images source directory
const CLEAN_IMAGES_DIR = path.join(__dirname, '../دهان/public/media/products/clean');

function getBase64Image(filename) {
  try {
    const filePath = path.join(CLEAN_IMAGES_DIR, filename);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
  } catch (err) {
    console.warn(`Could not load image ${filename}:`, err.message);
  }
  return '';
}

async function seed() {
  try {
    console.log('🚀 Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.DB_URL);
    console.log('✅ Connected to MongoDB Atlas successfully.');

    // 1. Backup existing data
    const existingCategories = await mongoose.connection.db.collection('categories').find({}).toArray();
    const existingProducts = await mongoose.connection.db.collection('products').find({}).toArray();
    
    const backupData = {
      timestamp: new Date().toISOString(),
      categoriesCount: existingCategories.length,
      productsCount: existingProducts.length,
      categories: existingCategories,
      products: existingProducts,
    };

    const backupFile = path.join(__dirname, 'backup_products_categories.json');
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`📦 Backup saved to ${backupFile} (${existingCategories.length} categories, ${existingProducts.length} products).`);

    // 2. Clear collections
    console.log('🧹 Clearing old products and categories collections...');
    await mongoose.connection.db.collection('products').deleteMany({});
    await mongoose.connection.db.collection('categories').deleteMany({});
    console.log('✅ Old products and categories cleared.');

    // 3. Define the 6 Architectural Stage Categories
    const categoriesData = [
      {
        name: 'مرحلة التأسيس',
        nameEn: 'Foundation Stage',
        code: 'foundation',
        description: 'سيلر مائي عازل ومقاوم للأملاح والنشع وتأسيس قوي للأسطح والخرسانة',
      },
      {
        name: 'المعجون',
        nameEn: 'Putty Stage',
        code: 'putty',
        description: 'معجون معماري داخلي وخارجي لتسوية وتجهيز الجدران',
      },
      {
        name: 'البطانة',
        nameEn: 'Undercoat Stage',
        code: 'undercoat',
        description: 'دهانات بطانة وأساس معماري عالي التغطية والبياض',
      },
      {
        name: 'تشطيب',
        nameEn: 'Finishing Stage',
        code: 'finishing',
        description: 'دهانات تشطيب نهائية فاخرة بأعلى متانة وألوان حيوية',
      },
      {
        name: 'مراحل تأسيسي لاكيه',
        nameEn: 'Lacquer Stage',
        code: 'lacquer',
        description: 'دهانات سنتيتك وميتالك فاخرة للأخشاب والمعادن',
      },
      {
        name: 'مراحل عزل',
        nameEn: 'Insulation Stage',
        code: 'insulation',
        description: 'عزل متقدم ومقاومة فائقة للرطوبة والعوامل الجوية',
      },
    ];

    console.log('🌱 Inserting 6 stage categories...');
    const insertedCategories = await Category.insertMany(categoriesData);
    const categoryMap = {};
    insertedCategories.forEach((cat) => {
      categoryMap[cat.code] = cat._id;
      console.log(`  - Category: ${cat.name} (${cat.code}) -> ID: ${cat._id}`);
    });

    // 4. Define the 15 Official Petrochem Products arranged strictly in stages
    const productsData = [
      // 01 - مرحلة التأسيس
      {
        name: 'سيلر مقاوم 333',
        code: 'PK-333',
        description: 'سيلر مائي فائق الجودة مصنع من بوليمرات أكريليكية متطورة، يعزل الرطوبة والأملاح وسد المسامات الخرسانية لضمان أقصى التصاق للدهانات.',
        category: categoryMap['foundation'],
        image: getBase64Image('WhatsApp_Image_2026-10-18_at_22.06.00-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 150,
        minStockThreshold: 20,
        isFeatured: true,
        statusBadge: 'مطابق للمواصفات',
        fetures: [
          { name: 'عزل تام للرطوبة والأملاح' },
          { name: 'اختراق عميق للمسامات الخرسانية' },
          { name: 'قوة التصاق عالية' },
          { name: 'توفير في استهلاك الدهان اللاحق' },
        ],
        packages: [
          { unitName: 'جالون', price: 140, weight: '2.5 لتر', note: 'عبوة أصلية معتمدة', colors: [] },
          { unitName: 'بستلة', price: 375.95, weight: '9 لتر', note: 'عبوة أصلية معتمدة', colors: [] },
        ],
        colors: [{ name: 'أبيض ناصع شفاف', code: 'W-01', hex: '#FFFFFF', price: 0 }],
      },

      // 02 - المعجون
      {
        name: 'معجون بترو 100',
        code: 'PK-100',
        description: 'معجون معماري عالي الجودة جاهز للاستخدام، يتميز بقوة ملء استثنائية وسهولة فائقة في الفرد والصنفرة لتسوية عيوب الجدران والأسطح.',
        category: categoryMap['putty'],
        image: getBase64Image('WhatsApp_Image_2026-10-19_at_18.41.29__1_-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 200,
        minStockThreshold: 30,
        isFeatured: true,
        statusBadge: 'الأكثر طلباً',
        fetures: [
          { name: 'سهولة الصنفرة دون تطاير غبار' },
          { name: 'قوة ملء عالية للشروخ' },
          { name: 'سطح حريري ناعم' },
          { name: 'مقاوم للتشققات' },
        ],
        packages: [
          { unitName: 'شكارة', price: 47, weight: '3 كجم', note: 'عبوة تجريبية للمساحات الصغيرة', colors: [] },
          { unitName: 'شكارة', price: 190, weight: '15 كجم', note: 'شكارة للمشاريع والمعمار', colors: [] },
        ],
        colors: [{ name: 'أبيض شاهق', code: 'P-100', hex: '#FFFFFF', price: 0 }],
      },
      {
        name: 'معجون اكريليك بترو 500',
        code: 'PK-500',
        description: 'معجون أكريليكي مطاطي فائق المرونة، مصمم خصيصاً لمعالجة التشققات ومقاومة الرطوبة والعوامل الجوية الخارجية والداخلية.',
        category: categoryMap['putty'],
        image: getBase64Image('WhatsApp_Image_2026-10-19_at_18.41.29-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 120,
        minStockThreshold: 15,
        isFeatured: false,
        statusBadge: 'مرونة فائقة',
        fetures: [
          { name: 'مرونة عالية تمنع عودة الشروخ' },
          { name: 'مقاومة تامة للرطوبة والحرارة' },
          { name: 'التصاق ممتاز بالخرسانة والمحارة' },
          { name: 'سهل التطبيق والتسوية' },
        ],
        packages: [
          { unitName: 'شكارة', price: 360.55, weight: '15 كجم', note: 'معجون بوليمري مرن', colors: [] },
        ],
        colors: [{ name: 'أبيض ناصع مرن', code: 'P-500', hex: '#FFFFFF', price: 0 }],
      },

      // 03 - البطانة
      {
        name: 'بستله ايكو كيم',
        code: 'PK-ECO',
        description: 'دهان بلاستيك مائي صديق للبيئة، يتميز ببياض ناصع ومعدل انتشار واسع يوفر أعلى كفاءة اقتصادية وتغطية ممتازة للمشاريع الكبيرة.',
        category: categoryMap['undercoat'],
        image: getBase64Image('WhatsApp_Image_2026-10-18_at_22.05.57__1_-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 180,
        minStockThreshold: 25,
        isFeatured: false,
        statusBadge: 'اقتصادي عالي التغطية',
        fetures: [
          { name: 'بياض ناصع ومشرق' },
          { name: 'تغطية واسعة للعبوة' },
          { name: 'اقتصادي وعالي التوفير' },
          { name: 'خالٍ من الروائح النفاذة' },
        ],
        packages: [
          { unitName: 'بستلة', price: 283.25, weight: '9 لتر', note: 'بستلة اقتصادية للمشاريع', colors: [] },
        ],
        colors: [{ name: 'أبيض ناصع', code: 'ECO-W', hex: '#FFFFFF', price: 0 }],
      },
      {
        name: 'كيما برو 5050',
        code: 'PK-5050',
        description: 'دهان احترافي مصمم للمشاريع الراقية، يجمع بين قوة التحمل الميكانيكي وسهولة التنظيف والمظهر المخملي الفاخر مع حماية دائمة.',
        category: categoryMap['undercoat'],
        image: getBase64Image('WhatsApp_Image_2026-10-18_at_22.05.57-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 160,
        minStockThreshold: 20,
        isFeatured: true,
        statusBadge: 'احترافي فاخر',
        fetures: [
          { name: 'مقاومة عالية للغسيل والمنظفات' },
          { name: 'ملمس ناعم نصف لامع' },
          { name: 'ثبات لوني يدوم لسنوات' },
          { name: 'صديق للبيئة' },
        ],
        packages: [
          { unitName: 'جالون', price: 165, weight: '2.5 لتر', note: 'جالون نصف لامع', colors: [] },
          { unitName: 'بستلة', price: 545.95, weight: '9 لتر', note: 'بستلة نصف لامع فاخرة', colors: [] },
        ],
        colors: [{ name: 'أبيض بلوري', code: 'KP-5050', hex: '#FFFFFF', price: 0 }],
      },
      {
        name: 'بلس 700',
        code: 'PK-700',
        description: 'دهان بلاستيك مطفي ناعم فائق البياض، يخفي عيوب الحوائط بكل كفاءة ويمنح الجدران دفئاً وأناقة هادئة متناهية الفخامة.',
        category: categoryMap['undercoat'],
        image: getBase64Image('WhatsApp_Image_2026-10-18_at_22.05.58__3_-removebg-preview (1) 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 140,
        minStockThreshold: 20,
        isFeatured: true,
        statusBadge: 'مطفي فخم',
        fetures: [
          { name: 'إخفاء تام لعيوب الحائط' },
          { name: 'مطفي بدون أي لمعة عاكسة' },
          { name: 'سهل الصيانة والتنظيف' },
          { name: 'بياض بلوري متجانس' },
        ],
        packages: [
          { unitName: 'جالون', price: 300, weight: '2.5 لتر', note: 'جالون مطفي ناعم', colors: [] },
          { unitName: 'بستلة', price: 978.5, weight: '9 لتر', note: 'بستلة مطفي فائق البياض', colors: [] },
        ],
        colors: [{ name: 'أبيض مط ناعم', code: 'PLS-700', hex: '#FFFFFF', price: 0 }],
      },

      // 04 - تشطيب
      {
        name: 'ورنيش كلير 444',
        code: 'PK-444',
        description: 'ورنيش مائي بلوري صديق للبيئة لحماية الأخشاب والحوائط والديكورات، يضفي طبقة عزل قوية ولامعة تبرز تفاصيل السطح الطبيعي.',
        category: categoryMap['finishing'],
        image: getBase64Image('WhatsApp_Image_2026-10-18_at_22.06.00-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 90,
        minStockThreshold: 15,
        isFeatured: false,
        statusBadge: 'حماية بلورية',
        fetures: [
          { name: 'شفافية بلورية عالية' },
          { name: 'حماية ضد الخدش والماء' },
          { name: 'سريع الجفاف وبدون رائحة' },
          { name: 'مقاوم للاصفرار بمرور الوقت' },
        ],
        packages: [
          { unitName: 'جالون', price: 200, weight: '2.25 لتر', note: 'ورنيش شفاف بلوري', colors: [] },
        ],
        colors: [{ name: 'شفاف بلوري لامع', code: 'CLR-444', hex: '#F0F8FF', price: 0 }],
      },
      {
        name: 'ستار 15000',
        code: 'PK-15000',
        description: 'دهان أكريليكي متطور ذو متانة عالية ومقاومة للظروف المناخية الصعبة، مصمم للجدران الداخلية والخارجية على السواء.',
        category: categoryMap['finishing'],
        image: getBase64Image('WhatsApp_Image_2026-10-18_at_22.05.59-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 110,
        minStockThreshold: 20,
        isFeatured: false,
        statusBadge: 'داخلي وخارجي',
        fetures: [
          { name: 'مقاوم للعوامل الجوية والحرارة' },
          { name: 'ألوان متألقة لا تبهت' },
          { name: 'حماية قوية ضد الرطوبة' },
          { name: 'تغطية ممتازة' },
        ],
        packages: [
          { unitName: 'جالون', price: 400, weight: '2.5 لتر', note: 'جالون أكريليك فائق التحمل', colors: [] },
          { unitName: 'بستلة', price: 1359.6, weight: '9 لتر', note: 'بستلة أكريليك فاخرة', colors: [] },
        ],
        colors: [{ name: 'أبيض ناصع أكريليك', code: 'STR-15K', hex: '#FFFFFF', price: 0 }],
      },
      {
        name: 'ستار 20000',
        code: 'PK-20000',
        description: 'قمة دهانات الأكريليك بملمس حريري ومقاومة جبارة للاحتكاك والرطوبة، يمنح الجدران عمقاً وفخامة تليق بأرقى التصاميم المعمارية.',
        category: categoryMap['finishing'],
        image: getBase64Image('WhatsApp_Image_2026-10-18_at_22.05.58__2_-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 130,
        minStockThreshold: 20,
        isFeatured: true,
        statusBadge: 'القمة الحريرية',
        fetures: [
          { name: 'مظهر حريري استثنائي' },
          { name: 'قابل للغسيل المتكرر بالمنظفات' },
          { name: 'مقاومة لأشعة الشمس فوق البنفسجية UV' },
          { name: 'تغطية فائقة للعبوة' },
        ],
        packages: [
          { unitName: 'جالون', price: 450, weight: '2.5 لتر', note: 'جالون حريري فاخر', colors: [] },
          { unitName: 'بستلة', price: 1529.95, weight: '9 لتر', note: 'بستلة حريرية للمشاريع الراقية', colors: [] },
        ],
        colors: [{ name: 'أبيض مخملي حريري', code: 'STR-20K', hex: '#FFFFFF', price: 0 }],
      },

      // 05 - مراحل تأسيسي لاكيه
      {
        name: 'كيما كوت مط 500 كل الاوزان',
        code: 'PK-KCOT500',
        description: 'دهان مطفي متعدد الاستخدامات لكافة الأوزان، يتميز بقوة التصاق فائقة وقدرة عالية على تغطية المساحات الواسعة بكفاءة واقتصادية.',
        category: categoryMap['lacquer'],
        image: getBase64Image('WhatsApp_Image_2026-10-19_at_00.34.28-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 170,
        minStockThreshold: 25,
        isFeatured: false,
        statusBadge: 'كافة الأوزان',
        fetures: [
          { name: 'متوفر بكافة الأوزان والعبوات' },
          { name: 'بياض معتمد للمشاريع' },
          { name: 'تغطية سريعة وموفرة' },
          { name: 'مثالي لكافة أنواع المحارة' },
        ],
        packages: [
          { unitName: 'كيلو', price: 98.88, weight: '0.7 لتر', note: 'عبوة كيلو مط ابيض', colors: [] },
          { unitName: 'جالون', price: 293.55, weight: '2.5 لتر', note: 'عبوة جالون مط ابيض', colors: [] },
          { unitName: 'بستلة', price: 2090.9, weight: '25 كجم', note: 'بستلة مشاريع 25 كجم', colors: [] },
        ],
        colors: [{ name: 'مط أبيض للمشاريع', code: 'KC-500', hex: '#FFFFFF', price: 0 }],
      },
      {
        name: 'لاكيه سوبر ستار كل الاوزان',
        code: 'PK-SUPERSTAR',
        description: 'دهان لاكيه زيتي عالي الجودة يتميز بصلابة فائقة ولمعان زجاجي مذهل لحماية الأبواب والمطابخ والحديد من التآكل والعوامل الجوية.',
        category: categoryMap['lacquer'],
        image: getBase64Image('WhatsApp_Image_2026-10-20_at_15.04.31-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 140,
        minStockThreshold: 20,
        isFeatured: true,
        statusBadge: 'لمعان زجاجي',
        fetures: [
          { name: 'متوفر بكافة الأوزان واللمعات' },
          { name: 'لمعان زجاجي يدوم طويلاً' },
          { name: 'حماية تامة ضد الصدأ والخدش' },
          { name: 'انسيابية عالية عند الدهان' },
        ],
        packages: [
          { unitName: 'نصف كيلو', price: 82.4, weight: '0.35 لتر', note: 'نصف كيلو لاكيه ممتاز', colors: [] },
          { unitName: 'كيلو', price: 164.8, weight: '0.7 لتر', note: 'كيلو لاكيه سنتيتك لامع', colors: [] },
          { unitName: 'جالون', price: 453.2, weight: '2 لتر', note: 'جالون لاكيه زجاجي للأبواب', colors: [] },
          { unitName: 'بستلة', price: 3605, weight: '20 كجم', note: 'بستلة ورش ومصانع خشب وحديد', colors: [] },
        ],
        colors: [{ name: 'أبيض لامع زجاجي', code: 'SS-WHITE', hex: '#FFFFFF', price: 0 }],
      },
      {
        name: 'لاكيه شامبين',
        code: 'PK-CHAMPAGNE',
        description: 'طلاء ديكوري متفرد يمنح المشغولات الخشبية والمعدنية والأبواب لون الشامبين الهادئ والمترف مع بريق مخملي جذاب يناسب أحدث التصاميم.',
        category: categoryMap['lacquer'],
        image: getBase64Image('WhatsApp_Image_2026-10-20_at_15.04.58-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 95,
        minStockThreshold: 15,
        isFeatured: true,
        statusBadge: 'شامبين ملكي',
        fetures: [
          { name: 'لون شامبين حصري فاخر' },
          { name: 'مقاوم لتغير اللون بالحرارة' },
          { name: 'سطح أملس فائق الأناقة' },
          { name: 'جودة سوبر ستار المعتمدة' },
        ],
        packages: [
          { unitName: 'كيلو', price: 180, weight: '0.7 لتر', note: 'كيلو لاكيه شامبين ديكوري', colors: [] },
          { unitName: 'جالون', price: 500, weight: '2 لتر', note: 'جالون شامبين ملكي فاخر', colors: [] },
        ],
        colors: [{ name: 'شامبين ملكي هادئ', code: 'L-CHAMP', hex: '#F7E7CE', price: 0 }],
      },
      {
        name: 'لاكيه ميتال',
        code: 'PK-METALLIC',
        description: 'دهان ميتالك بتأثير معدني بلوري عالي الانعكاس، يضفي طابعاً مستقبلياً فخماً على الأثاث والديكورات والأبواب والمطابخ.',
        category: categoryMap['lacquer'],
        image: getBase64Image('WhatsApp_Image_2026-10-20_at_15.06.01-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 85,
        minStockThreshold: 15,
        isFeatured: false,
        statusBadge: 'ميتالك براق',
        fetures: [
          { name: 'تأثير ميتالك معدني ساحر' },
          { name: 'مقاوم للرطوبة والاحتكاك' },
          { name: 'لمعان دائم لا يخفت' },
          { name: 'متانة ممتازة للأخشاب والمعادن' },
        ],
        packages: [
          { unitName: 'نصف كيلو', price: 100, weight: '0.35 لتر', note: 'نصف كيلو ميتالك فضي براق', colors: [] },
          { unitName: 'كيلو', price: 190, weight: '0.7 لتر', note: 'كيلو ميتالك معدني للمسات الديكور', colors: [] },
          { unitName: 'جالون', price: 500, weight: '2 لتر', note: 'جالون ميتالك للمطابخ والديكورات', colors: [] },
        ],
        colors: [{ name: 'ميتالك فضي معدني', code: 'L-MET', hex: '#C0C0C0', price: 0 }],
      },

      // 06 - مراحل عزل
      {
        name: 'بريمر بريكس كل الاوزان',
        code: 'PK-PRIMER',
        description: 'طبقة التأسيس الأولى لحماية الواجهات والمباني من الرطوبة والعوامل المناخية القاسية، متوفر بكافة العبوات والأوزان للمشاريع.',
        category: categoryMap['insulation'],
        image: getBase64Image('WhatsApp_Image_2026-10-19_at_00.35.57-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 115,
        minStockThreshold: 20,
        isFeatured: false,
        statusBadge: 'عزل أساسي',
        fetures: [
          { name: 'متوفر بجميع الأحجام والأوزان' },
          { name: 'حماية أولية قوية' },
          { name: 'مقاوم للقلويات والأملاح' },
          { name: 'يسهل تشغيل المعجون بكفاءة' },
        ],
        packages: [
          { unitName: 'نصف كيلو', price: 46.35, weight: '0.35 لتر', note: 'عبوة معالجة وترميم', colors: [] },
          { unitName: 'كيلو', price: 97.85, weight: '1 لتر', note: 'كيلو برايمر حماية خرسانية', colors: [] },
          { unitName: 'جالون', price: 283.25, weight: '2.5 لتر', note: 'جالون عزل وتأسيس', colors: [] },
          { unitName: 'بستلة', price: 1340, weight: '9 لتر', note: 'بستلة واجهات ومشاريع كبرى', colors: [] },
        ],
        colors: [
          { name: 'أحمر قرميدي', code: 'PRM-RED', hex: '#AF122F', price: 0 },
          { name: 'رمادي خرساني', code: 'PRM-GRAY', hex: '#64748B', price: 0 },
        ],
      },
      {
        name: 'بترو فورس',
        code: 'PK-FORCE',
        description: 'مركب عزل وحماية متطور يتمتع بقوة تماسك خارقة، مصمم لحماية الأسطح المعرضة لظروف بيئية قاسية ومنع تغلغل الرطوبة ومياه الأمطار.',
        category: categoryMap['insulation'],
        image: getBase64Image('WhatsApp_Image_2026-10-18_at_22.05.58__1_-removebg-preview 1.png'),
        warehouse: 'مستودع العاشر',
        quantity: 135,
        minStockThreshold: 20,
        isFeatured: true,
        statusBadge: 'عزل خارق',
        fetures: [
          { name: 'قوة تحمل ميكانيكية استثنائية' },
          { name: 'عزل مائي متفوق' },
          { name: 'مقاومة للأشعة فوق البنفسجية' },
          { name: 'حماية طويلة الأمد' },
        ],
        packages: [
          { unitName: 'جالون', price: 420, weight: '2.5 لتر', note: 'جالون بترو فورس حماية فائقة', colors: [] },
          { unitName: 'بستلة', price: 1450, weight: '9 لتر', note: 'بستلة عزل قوية للمنشآت والأسطح', colors: [] },
        ],
        colors: [{ name: 'رمادي عزل صلب', code: 'PF-GRAY', hex: '#4A5568', price: 0 }],
      },
    ];

    console.log('🌱 Inserting 15 official Petrochem products with sortOrder 1..15...');
    productsData.forEach((p, idx) => {
      p.sortOrder = idx + 1;
    });
    const insertedProducts = await Product.insertMany(productsData);
    console.log(`✅ Successfully seeded ${insertedProducts.length} products into MongoDB Atlas!`);

    insertedProducts.forEach((prod, idx) => {
      console.log(`  ${idx + 1}. [${prod.code}] ${prod.name} (Qty: ${prod.quantity})`);
    });

    console.log('🎉 Database seeding completed with 100% success.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  }
}

seed();
