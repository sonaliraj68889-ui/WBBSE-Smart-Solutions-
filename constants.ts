import { ClassLevel } from './types';

export interface UsefulLink {
  title: string;
  url: string;
  description: string;
  icon: string;
}

export const USEFUL_LINKS: UsefulLink[] = [
  {
    title: "WBBSE Solutions",
    url: "https://wbbsesolutions.com",
    description: "Detailed textbook solutions for all classes.",
    icon: "fa-graduation-cap"
  },
  {
    title: "Official WBBSE Board",
    url: "https://wbbse.wb.gov.in",
    description: "Official notices, routines, and results.",
    icon: "fa-building-columns"
  },
  {
    title: "WBBSE LP",
    url: "https://wbbselp.com",
    description: "Learning portal for Madhyamik students.",
    icon: "fa-laptop-code"
  },
  {
    title: "Banglar Shiksha",
    url: "https://banglarshiksha.gov.in",
    description: "Government portal for e-learning resources.",
    icon: "fa-chalkboard-user"
  },
  {
    title: "Hindi Medium Hub",
    url: "https://wbhindi.com",
    description: "Specific resources for Hindi medium students.",
    icon: "fa-language"
  }
];

export const CLASSES: ClassLevel[] = [
  {
    id: 'class-10',
    label: 'कक्षा 10 (माध्यमिक)',
    subjects: [
      {
        id: 'hindi',
        name: 'हिंदी',
        icon: 'fa-book-open',
        color: 'bg-red-600',
        chapters: [
          { id: '10-h-p1', title: 'काव्य-खण्ड: रैदास के पद' },
          { id: '10-h-p2', title: 'काव्य-खण्ड: आत्मत्राण' },
          { id: '10-h-p3', title: 'काव्य-खण्ड: नीड़ का निर्माण फिर-फिर' },
          { id: '10-h-p4', title: 'काव्य-खण्ड: मनुष्य और सर्प' },
          { id: '10-h-p5', title: 'काव्य-खण्ड: रामदास' },
          { id: '10-h-p6', title: 'काव्य-खण्ड: नौरंगिया' },
          { id: '10-h-p7', title: 'काव्य-खण्ड: देश-प्रेम' },
          { id: '10-h-g1', title: 'गद्य (निबंध): धूमकेतु' },
          { id: '10-h-g2', title: 'गद्य (निबंध): नौबतखाने में इबादत' },
          { id: '10-h-s1', title: 'गद्य (कहानी): उसने कहा था' },
          { id: '10-h-s2', title: 'गद्य (कहानी): नन्हा संगीतकार' },
          { id: '10-h-s3', title: 'गद्य (कहानी): चप्पल' },
          { id: '10-h-s4', title: 'गद्य (कहानी): नमक' },
          { id: '10-h-s5', title: 'गद्य (कहानी): धावक' },
          { id: '10-h-e1', title: 'एकांकी: दीपदान' },
          { id: '10-h-sup1', title: 'सहायक पाठ: तीसरी कसम' },
          { id: '10-h-sup2', title: 'सहायक पाठ: कर्मनाशा की हार' },
          { id: '10-h-sup3', title: 'सहायक पाठ: जाँच अभी जारी है' },
          { id: '10-h-v1', title: 'व्याकरण: कारक' },
          { id: '10-h-v2', title: 'व्याकरण: समास' },
          { id: '10-h-v3', title: 'व्याकरण: वाक्य' },
          { id: '10-h-v4', title: 'व्याकरण: वाच्य' },
          { id: '10-h-w1', title: 'रचना: निबंध लेखन (विभिन्न विषय)' },
          { id: '10-h-w2', title: 'रचना: अंग्रेजी से हिन्दी अनुवाद' },
          { id: '10-h-w3', title: 'रचना: प्रतिवेदन-लेखन' },
          { id: '10-h-w4', title: 'रचना: संवाद-लेखन' }
        ],
      },
      {
        id: 'english',
        name: 'English',
        icon: 'fa-pen-nib',
        color: 'bg-orange-600',
        chapters: [
          { id: '10-e-1', title: 'Father\'s Help' },
          { id: '10-e-2', title: 'Fable' },
          { id: '10-e-3', title: 'The Passing Away of Bapu' },
          { id: '10-e-4', title: 'My Own True Family' },
          { id: '10-e-5', title: 'Our Runaway Kite' },
          { id: '10-e-6', title: 'Sea Fever' },
          { id: '10-e-7', title: 'The Cat' },
          { id: '10-e-8', title: 'The Snail' }
        ]
      },
      {
        id: 'math',
        name: 'गणित',
        icon: 'fa-calculator',
        color: 'bg-indigo-600',
        chapters: [
          { id: '10-m-1', title: 'एक चर वाले द्विघात समीकरण' },
          { id: '10-m-2', title: 'सरल ब्याज' },
          { id: '10-m-3', title: 'वृत्त से संबंधित प्रमेय' },
          { id: '10-m-4', title: 'आयताकार समांतर षट्फलक या घनाभ' },
          { id: '10-m-5', title: 'अनुपात और समानुपात' },
          { id: '10-m-6', title: 'चक्रवृद्धि ब्याज और समान वृद्धि दर' },
          { id: '10-m-8', title: 'लंब वृत्ताकार बेलन' },
          { id: '10-m-9', title: 'द्विघात करणी' },
          { id: '10-m-12', title: 'गोलक' },
          { id: '10-m-13', title: 'भेद' },
          { id: '10-m-14', title: 'साझा व्यापार' },
          { id: '10-m-16', title: 'लंब वृत्ताकार शंकु' },
          { id: '10-m-18', title: 'सदृशता' },
          { id: '10-m-20', title: 'त्रिकोणमिति: कोण मापन की अवधारणा' },
          { id: '10-m-23', title: 'त्रिकोणमितीय अनुपात और सर्वसमिकाएँ' },
          { id: '10-m-25', title: 'ऊँचाई और दूरी' },
          { id: '10-m-26', title: 'सांख्यिकी: माध्य, माध्यक, ओजाइव, बहुलक' }
        ],
      },
      {
        id: 'physci',
        name: 'भौतिक विज्ञान',
        icon: 'fa-atom',
        color: 'bg-emerald-600',
        chapters: [
          { id: '10-ps-1', title: 'हमारे पर्यावरण के प्रति चिंता' },
          { id: '10-ps-2', title: 'गैसों का व्यवहार' },
          { id: '10-ps-3', title: 'रासायनिक गणना' },
          { id: '10-ps-4', title: 'तापीय घटना' },
          { id: '10-ps-5', title: 'प्रकाश' },
          { id: '10-ps-6', title: 'धारा विद्युत' },
          { id: '10-ps-7', title: 'परमाणु नाभिक' },
          { id: '10-ps-8.1', title: 'आवर्त सारणी' },
          { id: '10-ps-8.2', title: 'आयनिक और सहसंयोजक बंधन' },
          { id: '10-ps-8.3', title: 'वैद्युतिकी और रासायनिक अभिक्रिया' },
          { id: '10-ps-8.4', title: 'अकार्बनिक रसायन' },
          { id: '10-ps-8.5', title: 'धातुकर्म' },
          { id: '10-ps-8.6', title: 'कार्बनिक रसायन' }
        ],
      },
      {
        id: 'lifesci',
        name: 'जीवन विज्ञान',
        icon: 'fa-dna',
        color: 'bg-green-600',
        chapters: [
          { id: '10-ls-1', title: 'जीव जगत में नियंत्रण एवं समन्वय' },
          { id: '10-ls-2', title: 'जीवन की निरंतरता' },
          { id: '10-ls-3', title: 'वंशानुगति' },
          { id: '10-ls-4', title: 'अभिव्यक्ति और अनुकूलन' },
          { id: '10-ls-5', title: 'पर्यावरण और उसके संसाधन' }
        ]
      },
      {
        id: 'hist',
        name: 'इतिहास',
        icon: 'fa-landmark',
        color: 'bg-amber-600',
        chapters: [
          { id: '10-hi-1', title: 'इतिहास की अवधारणा' },
          { id: '10-hi-2', title: 'सुधार: विशेषताएँ और अवलोकन' },
          { id: '10-hi-3', title: 'प्रतिरोध और विद्रोह' },
          { id: '10-hi-4', title: 'संघबद्धता की प्रारंभिक अवस्था' },
          { id: '10-hi-5', title: 'वैकल्पिक विचार और पहल' },
          { id: '10-hi-6', title: '20वीं सदी के भारत में आंदोलन' },
          { id: '10-hi-7', title: 'महिला एवं छात्र आंदोलन' },
          { id: '10-hi-8', title: 'उत्तर-औपनिवेशिक भारत' }
        ]
      },
      {
        id: 'geo',
        name: 'भूगोल',
        icon: 'fa-earth-europe',
        color: 'bg-teal-600',
        chapters: [
          { id: '10-g-1', title: 'बहिर्जात प्रक्रियाएं' },
          { id: '10-g-2', title: 'वायुमंडल' },
          { id: '10-g-3', title: 'जलमंडल' },
          { id: '10-g-4', title: 'अपशिष्ट प्रबंधन' },
          { id: '10-g-5', title: 'भारत: प्राकृतिक और आर्थिक' },
          { id: '10-g-6', title: 'उपग्रह चित्र और स्थलाकृतिक मानचित्र' }
        ]
      }
    ],
  },
  {
    id: 'class-9',
    label: 'कक्षा 9',
    subjects: [
      {
        id: 'hindi',
        name: 'हिंदी (साहित्य संचयन)',
        icon: 'fa-book-open',
        color: 'bg-red-500',
        chapters: [
          { id: '9-h-p1', title: 'काव्य: विनय के पद' },
          { id: '9-h-p2', title: 'काव्य: धीरे-धीरे उतर क्षितिज से' },
          { id: '9-h-p3', title: 'काव्य: पेड़ का दर्द' },
          { id: '9-h-p4', title: 'काव्य: जरुरतों के नाम पर' },
          { id: '9-h-p5', title: 'काव्य: कलकत्ता' },
          { id: '9-h-p6', title: 'काव्य: सबसे खतरनाक' },
          { id: '9-h-p7', title: 'काव्य: यमराज की दिशा' },
          { id: '9-h-p8', title: 'काव्य: कर चले हम फ़िदा' },
          { id: '9-h-g1', title: 'गद्य: स्त्री-शिक्षा के विरोधी कुतर्कों का खण्डन' },
          { id: '9-h-g2', title: 'गद्य: हिंसा परम धर्मः' },
          { id: '9-h-g3', title: 'गद्य: संस्कृति है क्या?' },
          { id: '9-h-g4', title: 'गद्य: ठेले पर हिमालय' },
          { id: '9-h-g5', title: 'गद्य: भोलाराम का जीव' },
          { id: '9-h-g6', title: 'गद्य: वापसी' },
          { id: '9-h-g7', title: 'गद्य: पर्यावरण संरक्षण' },
          { id: '9-h-g8', title: 'गद्य: गिरगिट' },
          { id: '9-h-e1', title: 'एकांकी: बहू की विदा' },
          { id: '9-h-s1', title: 'सहायक पाठ: कालिदास' },
          { id: '9-h-s2', title: 'सहायक पाठ: गुरु नानक' },
          { id: '9-h-s3', title: 'सहायक पाठ: स्वामी दयानंद सरस्वती' },
          { id: '9-h-s4', title: 'सहायक पाठ: राजा राममोहन राय' },
          { id: '9-h-s5', title: 'सहायक पाठ: आचार्य जगदीश चंद्र बोस' },
          { id: '9-h-s6', title: 'सहायक पाठ: गोपाल कृष्ण गोखले' },
          { id: '9-h-s7', title: 'सहायक पाठ: बाल गंगाधर तिलक' },
          { id: '9-h-s8', title: 'सहायक पाठ: मोतीलाल नेहरू' },
          { id: '9-h-s9', title: 'सहायक पाठ: लाला लाजपत राय' },
          { id: '9-h-s10', title: 'सहायक पाठ: रवीन्द्रनाथ ठाकुर' },
          { id: '9-h-s11', title: 'सहायक पाठ: सरदार वल्लभ भाई पटेल' },
          { id: '9-h-s12', title: 'सहायक पाठ: डॉ. राजेन्द्र प्रसाद' },
          { id: '9-h-s13', title: 'सहायक पाठ: मौलाना अबुल कलाम आज़ाद' },
          { id: '9-h-v1', title: 'व्याकरण: उच्चारण स्थान के आधार पर ध्वनियों का वर्गीकरण' },
          { id: '9-h-v2', title: 'व्याकरण: ध्वनि तथा ध्वनि परिवर्तन के कारण' },
          { id: '9-h-v3', title: 'व्याकरण: ध्वनि परिवर्तन की रीतियाँ/दिशाएँ' },
          { id: '9-h-v4', title: 'व्याकरण: संधि' },
          { id: '9-h-v5', title: 'व्याकरण: व्युत्पत्ति के आधार पर शब्दों का वर्गीकरण' },
          { id: '9-h-v6', title: 'व्याकरण: उपसर्ग' },
          { id: '9-h-v7', title: 'व्याकरण: प्रत्यय' },
          { id: '9-h-v8', title: 'व्याकरण: शब्द एवं पद-विचार' },
          { id: '9-h-v9', title: 'व्याकरण: संज्ञा' },
          { id: '9-h-v10', title: 'व्याकरण: सर्वनाम' },
          { id: '9-h-v11', title: 'व्याकरण: विशेषण' },
          { id: '9-h-v12', title: 'व्याकरण: क्रिया' },
          { id: '9-h-v13', title: 'व्याकरण: अव्यय' },
          { id: '9-h-v14', title: 'व्याकरण: समास' }
        ]
      },
      {
        id: 'english',
        name: 'English',
        icon: 'fa-feather-pointed',
        color: 'bg-orange-500',
        chapters: [
          { id: '9-e-1', title: 'Tales of Bhola Grandpa' },
          { id: '9-e-2', title: 'All about a Dog' },
          { id: '9-e-3', title: 'Autumn' },
          { id: '9-e-4', title: 'A Day in the Zoo' },
          { id: '9-e-5', title: 'All Summer in a Day' },
          { id: '9-e-6', title: 'Mild the Mist upon the Hill' },
          { id: '9-e-7', title: 'Tom Loses a Tooth' },
          { id: '9-e-8', title: 'His First Flight' },
          { id: '9-e-9', title: 'The North Ship' },
          { id: '9-e-10', title: 'The Price of Bananas' },
          { id: '9-e-11', title: 'A Shipwrecked Sailor' },
          { id: '9-e-12', title: 'Hunting Snake' }
        ]
      },
      {
        id: 'math',
        name: 'गणित',
        icon: 'fa-square-root-variable',
        color: 'bg-indigo-500',
        chapters: [
          { id: '9-m-1', title: 'वास्तविक संख्या' },
          { id: '9-m-2', title: 'सूचकांक के नियम' },
          { id: '9-m-3', title: 'लेखाचित्र' },
          { id: '9-m-4', title: 'स्थानांक ज्यामिति: दूरी सूत्र' },
          { id: '9-m-5', title: 'रैखिक सह-समीकरण' },
          { id: '9-m-6', title: 'आयतकार क्षेत्र का क्षेत्रफल' },
          { id: '9-m-7', title: 'बहुपदी व्यंजक' },
          { id: '9-m-8', title: 'गुणनखंडन' },
          { id: '9-m-9', title: 'भेदक और मध्य-बिंदु प्रमेय' },
          { id: '9-m-10', title: 'लाभ और हानि' },
          { id: '9-m-11', title: 'सांख्यिकी' },
          { id: '9-m-12', title: 'त्रिभुज और चतुर्भुज का क्षेत्रफल' },
          { id: '9-m-13', title: 'वृत्त की परिधि' },
          { id: '9-m-14', title: 'वृत्त का क्षेत्रफल' },
          { id: '9-m-15', title: 'लघुगणक (Logarithm)' }
        ]
      },
      {
        id: 'physci',
        name: 'भौतिक विज्ञान',
        icon: 'fa-flask-vial',
        color: 'bg-emerald-500',
        chapters: [
          { id: '9-ps-1', title: 'मापन' },
          { id: '9-ps-2', title: 'बल और गति' },
          { id: '9-ps-3', title: 'पदार्थ: संरचना और गुण' },
          { id: '9-ps-4', title: 'परमाणु संरचना' },
          { id: '9-ps-5', title: 'मोल की अवधारणा' },
          { id: '9-ps-6', title: 'विलयन' },
          { id: '9-ps-7', title: 'अम्ल, क्षार और लवण' },
          { id: '9-ps-8', title: 'कार्य, शक्ति और ऊर्जा' },
          { id: '9-ps-9', title: 'ऊष्मा' },
          { id: '9-ps-10', title: 'ध्वनि' }
        ]
      },
      {
        id: 'lifesci',
        name: 'जीवन विज्ञान',
        icon: 'fa-dna',
        color: 'bg-green-600',
        chapters: [
          { id: '9-ls-1', title: 'जीवन और इसकी विविधता' },
          { id: '9-ls-2', title: 'जीवन के संगठन का स्तर' },
          { id: '9-ls-3', title: 'जीवन की शारीरिक प्रक्रियाएं' },
          { id: '9-ls-4', title: 'जीवविज्ञान और मानव कल्याण' },
          { id: '9-ls-5', title: 'पर्यावरण और उसके संसाधन' }
        ]
      },
      {
        id: 'hist',
        name: 'इतिहास',
        icon: 'fa-landmark',
        color: 'bg-amber-500',
        chapters: [
          { id: '9-hi-1', title: 'फ्रांसीसी क्रांति के कुछ पहलू' },
          { id: '9-hi-2', title: 'क्रांतिकारी आदर्श, नेपोलियन साम्राज्य' },
          { id: '9-hi-3', title: 'उन्नीसवीं सदी का यूरोप' },
          { id: '9-hi-4', title: 'औद्योगिक क्रांति, उपनिवेशवाद और साम्राज्यवाद' },
          { id: '9-hi-5', title: 'बीसवीं सदी का यूरोप' },
          { id: '9-hi-6', title: 'द्वितीय विश्व युद्ध और उसके बाद' },
          { id: '9-hi-7', title: 'संयुक्त राष्ट्र संघ (UNO)' }
        ]
      },
      {
        id: 'geo',
        name: 'भूगोल',
        icon: 'fa-earth-europe',
        color: 'bg-teal-500',
        chapters: [
          { id: '9-g-1', title: 'ग्रह के रूप में पृथ्वी' },
          { id: '9-g-2', title: 'पृथ्वी की गतियां' },
          { id: '9-g-3', title: 'पृथ्वी के धरातल पर स्थान निर्धारण' },
          { id: '9-g-4', title: 'भू-आकृतिक प्रक्रियाएं' },
          { id: '9-g-5', title: 'अपक्षय' },
          { id: '9-g-6', title: 'आपदा और प्रबंधन' },
          { id: '9-g-7', title: 'भारत के संसाधन' },
          { id: '9-g-8', title: 'पश्चिम बंगाल' }
        ]
      }
    ],
  },
  {
    id: 'class-8',
    label: 'कक्षा 8',
    subjects: [
      {
        id: 'hindi',
        name: 'हिंदी',
        icon: 'fa-book-open',
        color: 'bg-red-400',
        chapters: [
          { id: '8-h-p1', title: 'काव्य: सूर के पद' },
          { id: '8-h-p2', title: 'काव्य: भारतमाता का मंदिर' },
          { id: '8-h-p3', title: 'काव्य: प्रियतम' },
          { id: '8-h-p4', title: 'काव्य: जनगीत' },
          { id: '8-h-p5', title: 'काव्य: यदि फूल नहीं बो सकते तो' },
          { id: '8-h-p6', title: 'काव्य: कोई नहीं पराया' },
          { id: '8-h-p7', title: 'काव्य: नई नारी' },
          { id: '8-h-p8', title: 'काव्य: वापसी' },
          { id: '8-h-g1', title: 'गद्य: श्रम की प्रतिष्ठा' },
          { id: '8-h-g2', title: 'गद्य: सुभान खाँ' },
          { id: '8-h-g3', title: 'गद्य: नीलू' },
          { id: '8-h-g4', title: 'गद्य: भिखारिन' },
          { id: '8-h-g5', title: 'गद्य: टोबा टेक सिंह' },
          { id: '8-h-g6', title: 'गद्य: अपराजिता' },
          { id: '8-h-g7', title: 'गद्य: शाप मुक्ति' },
          { id: '8-h-g8', title: 'गद्य: पानी की कहानी' },
          { id: '8-h-e1', title: 'एकांकी: कारतूस' },
          { id: '8-h-s1', title: 'सहायक पाठ: नया रास्ता' }
        ]
      },
      {
        id: 'english',
        name: 'English',
        icon: 'fa-book',
        color: 'bg-orange-400',
        chapters: [
          { id: '8-e-1', title: 'The Wind Cap' },
          { id: '8-e-2', title: 'Clouds' },
          { id: '8-e-3', title: 'An April Day' },
          { id: '8-e-4', title: 'The Great Escape' },
          { id: '8-e-5', title: 'Princess September' },
          { id: '8-e-6', title: 'The Sea' },
          { id: '8-e-7', title: 'A King\'s Tale' },
          { id: '8-e-8', title: 'The Happy Prince' },
          { id: '8-e-9', title: 'Summer Friends' },
          { id: '8-e-10', title: 'Tales of Childhood' },
          { id: '8-e-11', title: 'Midnight Express' },
          { id: '8-e-12', title: 'Someone' },
          { id: '8-e-13', title: 'The Old Man at the Bridge' }
        ]
      },
      {
        id: 'math',
        name: 'गणित',
        icon: 'fa-plus-minus',
        color: 'bg-indigo-400',
        chapters: [
          { id: '8-m-1', title: 'पूर्व पाठों की पुनरावृत्ति' },
          { id: '8-m-2', title: 'परिमेय संख्या की अवधारणा' },
          { id: '8-m-3', title: 'पाई-चित्र' },
          { id: '8-m-5', title: 'घनफल की अवधारणा' },
          { id: '8-m-6', title: 'बीजगणितीय संख्याओं का गुणन और भाग' },
          { id: '8-m-8', title: 'बीजगणितीय संख्याओं का गुणनखंडन' },
          { id: '8-m-10', title: 'त्रैराशिक नियम' },
          { id: '8-m-11', title: 'प्रतिशत' },
          { id: '8-m-12', title: 'मिश्रण' },
          { id: '8-m-13', title: 'समय और कार्य' }
        ]
      },
      {
        id: 'science',
        name: 'विज्ञान',
        icon: 'fa-microscope',
        color: 'bg-green-400',
        chapters: [
          { id: '8-s-1', title: 'भौतिक पर्यावरण: बल और दबाव' },
          { id: '8-s-2', title: 'पदार्थ की प्रकृति' },
          { id: '8-s-3', title: 'सजीव जगत की संरचना' },
          { id: '8-s-4', title: 'अंतःस्रावी ग्रंथियां और किशोरवस्था' },
          { id: '8-s-5', title: 'जैव विविधता और संरक्षण' },
          { id: '8-s-6', title: 'कृषि प्रणाली' }
        ]
      },
      {
        id: 'hist',
        name: 'इतिहास',
        icon: 'fa-shield-halved',
        color: 'bg-amber-500',
        chapters: [
          { id: '8-hi-1', title: 'क्षेत्रीय शक्तियों का उदय' },
          { id: '8-hi-2', title: 'औपनिवेशिक प्रभुत्व की स्थापना' },
          { id: '8-hi-3', title: 'औपनिवेशिक अर्थव्यवस्था' },
          { id: '8-hi-4', title: 'विद्रोह और प्रतिरोध' },
          { id: '8-hi-5', title: 'भारतीय राष्ट्रवाद के आधार' }
        ]
      },
      {
        id: 'geo',
        name: 'भूगोल',
        icon: 'fa-earth-americas',
        color: 'bg-teal-400',
        chapters: [
          { id: '8-g-1', title: 'पृथ्वी के अंदर' },
          { id: '8-g-2', title: 'अस्थिर पृथ्वी' },
          { id: '8-g-3', title: 'वायुदाब और हवा' },
          { id: '8-g-4', title: 'बादल और वर्षा' },
          { id: '8-g-5', title: 'उत्तर अमेरिका' }
        ]
      }
    ],
  },
  {
    id: 'class-7',
    label: 'कक्षा 7',
    subjects: [
      {
        id: 'hindi',
        name: 'हिंदी',
        icon: 'fa-book-open',
        color: 'bg-red-300',
        chapters: [
          { id: '7-h-p1', title: 'पद्य खण्ड: मीरा के पद' },
          { id: '7-h-p2', title: 'पद्य खण्ड: संगठन' },
          { id: '7-h-p3', title: 'पद्य खण्ड: भारत वर्ष' },
          { id: '7-h-p4', title: 'पद्य खण्ड: जागरण गीत' },
          { id: '7-h-p5', title: 'पद्य खण्ड: रक्षा बंधन' },
          { id: '7-h-p6', title: 'पद्य खण्ड: वरदान माँगूँगा नहीं' },
          { id: '7-h-p7', title: 'पद्य खण्ड: कोई चिराग नहीं हैं मगर उजाला है' },
          { id: '7-h-p8', title: 'पद्य खण्ड: माँ' },
          { id: '7-h-g1', title: 'गद्य खण्ड: आदर्श विद्यार्थी' },
          { id: '7-h-g2', title: 'गद्य खण्ड: सरदार वल्लभभाई पटेल' },
          { id: '7-h-g3', title: 'गद्य खण्ड: संन्यासी' },
          { id: '7-h-g4', title: 'गद्य खण्ड: संस्कृति' },
          { id: '7-h-g5', title: 'गद्य खण्ड: अजन्ता की चित्रकला' },
          { id: '7-h-g6', title: 'गद्य खण्ड: क्यों-क्यों लड़की' },
          { id: '7-h-g7', title: 'गद्य खण्ड: वारिस' },
          { id: '7-h-g8', title: 'गद्य खण्ड: कामचोर' },
          { id: '7-h-e1', title: 'एकांकी: पापा खो गए' },
          { id: '7-h-s1', title: 'सहायक पाठ: गुलिवर की यात्राएँ' }
        ]
      },
      {
        id: 'english',
        name: 'English',
        icon: 'fa-language',
        color: 'bg-orange-300',
        chapters: [
          { id: '7-e-1', title: 'The Book of Nature' },
          { id: '7-e-2', title: 'The Riddle' },
          { id: '7-e-3', title: 'We are Seven' },
          { id: '7-e-4', title: 'The Beauty and the Beast' },
          { id: '7-e-5', title: 'Uncle Podger Hangs a Picture' },
          { id: '7-e-6', title: 'The Vagabond' },
          { id: '7-e-7', title: 'Mowgli Among the Wolves' },
          { id: '7-e-8', title: 'The Story of Proserpine' },
          { id: '7-e-9', title: 'J.C. Bose: A Beautiful Mind' },
          { id: '7-e-10', title: 'The Echoing Green' },
          { id: '7-e-11', title: 'The Axe' },
          { id: '7-e-12', title: 'My Diary' },
          { id: '7-e-13', title: 'Ghosts on the Verandah' }
        ]
      },
      {
        id: 'math',
        name: 'गणित',
        icon: 'fa-divide',
        color: 'bg-indigo-300',
        chapters: [
          { id: '7-m-0', title: 'पूर्व पाठों की पुनरावृत्ति' },
          { id: '7-m-1', title: 'अनुपात' },
          { id: '7-m-2', title: 'समानुपात' },
          { id: '7-m-3', title: 'पूर्णांकों की अवधारणा' },
          { id: '7-m-4', title: 'भिन्न' },
          { id: '7-m-5', title: 'घातांक' },
          { id: '7-m-6', title: 'बीजगणितीय चर की अवधारणा' },
          { id: '7-m-7', title: 'रैखिक समीकरण' },
          { id: '7-m-8', title: 'समान्तरिक रेखाएँ' },
          { id: '7-m-9', title: 'त्रिभुज की रचना' },
          { id: '7-m-10', title: 'प्रतिशत' },
          { id: '7-m-11', title: 'समय और दूरी' }
        ]
      },
      {
        id: 'science',
        name: 'विज्ञान',
        icon: 'fa-leaf',
        color: 'bg-green-300',
        chapters: [
          { id: '7-s-1', title: 'भौतिक पर्यावरण: ऊष्मा' },
          { id: '7-s-2', title: 'भौतिक पर्यावरण: प्रकाश' },
          { id: '7-s-3', title: 'भौतिक पर्यावरण: चुंबकत्व' },
          { id: '7-s-4', title: 'स्थिर विद्युत' },
          { id: '7-s-5', title: 'परमाणु, अणु और रासायनिक अभिक्रिया' },
          { id: '7-s-6', title: 'पर्यावरण और सतत विकास' },
          { id: '7-s-7', title: 'मानव शरीर का संगठन' },
          { id: '7-s-8', title: 'खाद्य और स्वास्थ्य' }
        ]
      },
      {
        id: 'hist',
        name: 'इतिहास',
        icon: 'fa-scroll',
        color: 'bg-amber-400',
        chapters: [
          { id: '7-hi-1', title: 'इतिहास की समझ' },
          { id: '7-hi-2', title: 'भारत का इतिहास: एक परिचय' },
          { id: '7-hi-3', title: 'मध्यकालीन भारत में क्षेत्रीय शक्तियां' },
          { id: '7-hi-4', title: 'दिल्ली के सुल्तान' },
          { id: '7-hi-5', title: 'मुगल साम्राज्य' },
          { id: '7-hi-6', title: 'भक्ति और सूफी आंदोलन' },
          { id: '7-hi-7', title: 'मध्यकालीन भारत का जीवन' }
        ]
      },
      {
        id: 'geo',
        name: 'भूगोल',
        icon: 'fa-map-location-dot',
        color: 'bg-teal-300',
        chapters: [
          { id: '7-g-1', title: 'पृथ्वी की गतियां' },
          { id: '7-g-2', title: 'वायुदाब और पवन' },
          { id: '7-g-3', title: 'भूमि और नदियां' },
          { id: '7-g-4', title: 'मिट्टी और वनस्पति' },
          { id: '7-g-5', title: 'अफ्रीका' },
          { id: '7-g-6', title: 'यूरोप' },
          { id: '7-g-7', title: 'एशिया का परिचय' }
        ]
      }
    ],
  },
  {
    id: 'class-6',
    label: 'कक्षा 6',
    subjects: [
      {
        id: 'hindi',
        name: 'हिंदी',
        icon: 'fa-book-open',
        color: 'bg-red-200',
        chapters: [
          { id: '6-h-p1', title: 'पद्य खण्ड: वृंद के दोहे' },
          { id: '6-h-p2', title: 'पद्य खण्ड: इनसे सीखो' },
          { id: '6-h-p3', title: 'पद्य खण्ड: वह चिड़िया जो' },
          { id: '6-h-p4', title: 'पद्य खण्ड: भगवान के डाकिए' },
          { id: '6-h-p5', title: 'पद्य खण्ड: धानों का गीत' },
          { id: '6-h-p6', title: 'पद्य खण्ड: जीवन का झरना' },
          { id: '6-h-p7', title: 'पद्य खण्ड: कठपुतली' },
          { id: '6-h-p8', title: 'पद्य खण्ड: बादल चले गये वे' },
          { id: '6-h-g1', title: 'गद्य खण्ड: दो भाई' },
          { id: '6-h-g2', title: 'गद्य खण्ड: कश्मीर' },
          { id: '6-h-g3', title: 'गद्य खण्ड: तिवारी का तोता' },
          { id: '6-h-g4', title: 'गद्य खण्ड: अपूर्व अनुभव' },
          { id: '6-h-g5', title: 'गद्य खण्ड: क्या निराश हुआ जाए' },
          { id: '6-h-g6', title: 'गद्य खण्ड: अकेली' },
          { id: '6-h-g7', title: 'गद्य खण्ड: कठोर कृपा' },
          { id: '6-h-g8', title: 'गद्य खण्ड: गूदड़ साईं' },
          { id: '6-h-e1', title: 'एकांकी: ऐसे-ऐसे' },
          { id: '6-h-s1', title: 'सहायक पाठ: हरिहर काका' },
          { id: '6-h-s2', title: 'सहायक पाठ: टोपी शुक्ला' },
          { id: '6-h-s3', title: 'सहायक पाठ: आइए चलें प्रकृति की ओर' }
        ]
      },
      {
        id: 'english',
        name: 'English',
        icon: 'fa-microphone-lines',
        color: 'bg-orange-200',
        chapters: [
          { id: '6-e-1', title: 'It All Began With Drip-Drip' },
          { id: '6-e-2', title: 'The Adventurous Clown' },
          { id: '6-e-3', title: 'The Rainbow' },
          { id: '6-e-4', title: 'The Shop That Never Was' },
          { id: '6-e-5', title: 'Land of the Pharaohs' },
          { id: '6-e-6', title: 'How the Little Kite Learned to Fly' },
          { id: '6-e-7', title: 'The Magic Fish Bone' },
          { id: '6-e-8', title: 'Goodbye to the Moon' },
          { id: '6-e-9', title: 'I Will Go With My Father A-ploughing' },
          { id: '6-e-10', title: 'Smart Ice Cream' },
          { id: '6-e-11', title: 'The Blind Boy' }
        ]
      },
      {
        id: 'math',
        name: 'गणित',
        icon: 'fa-equals',
        color: 'bg-indigo-200',
        chapters: [
          { id: '6-m-0', title: 'संख्याओं का परिचय' },
          { id: '6-m-1', title: 'बोडमास (BODMAS) नियम' },
          { id: '6-m-2', title: 'ल.स.प. और म.स.प. (LCM & HCF)' },
          { id: '6-m-3', title: 'दशमलव और भिन्न' },
          { id: '6-m-4', title: 'अनुपात और समानुपात' },
          { id: '6-m-5', title: 'प्रतिशत की अवधारणा' },
          { id: '6-m-6', title: 'सांख्यिकी' },
          { id: '6-m-7', title: 'ज्यामिति का परिचय' }
        ]
      },
      {
        id: 'science',
        name: 'विज्ञान',
        icon: 'fa-wind',
        color: 'bg-sky-400',
        chapters: [
          { id: '6-s-1', title: 'सजीवों की परस्पर निर्भरता' },
          { id: '6-s-2', title: 'पदार्थ की प्रकृति और गुण' },
          { id: '6-s-3', title: 'मापन की अवधारणा' },
          { id: '6-s-4', title: 'सामान्य मशीनें' },
          { id: '6-s-5', title: 'जैव विविधता' },
          { id: '6-s-6', title: 'अपशिष्ट प्रबंधन' },
          { id: '6-s-7', title: 'बल और दबाव' }
        ]
      }
    ],
  },
  {
    id: 'class-5',
    label: 'कक्षा 5',
    subjects: [
      {
        id: 'hindi',
        name: 'हिंदी',
        icon: 'fa-book',
        color: 'bg-pink-600',
        chapters: [
          { id: '5-h-1', title: 'नन्हा पौधा' },
          { id: '5-h-2', title: 'सच्ची जीत' },
          { id: '5-h-3', title: 'विद्यासागर' },
          { id: '5-h-4', title: 'समय (कविता)' },
          { id: '5-h-5', title: 'खिलौनेवाला' },
          { id: '5-h-6', title: 'चिट्ठी का सफर' },
          { id: '5-h-7', title: 'स्वदेश प्रेम' },
          { id: '5-h-8', title: 'बुद्धिमान खरगोश' }
        ]
      },
      {
        id: 'english',
        name: 'English',
        icon: 'fa-language',
        color: 'bg-orange-500',
        chapters: [
          { id: '5-e-1', title: 'India: Superpower in Cricket' },
          { id: '5-e-2', title: 'A Feat on Feet' },
          { id: '5-e-3', title: 'Phulmani\'s India' },
          { id: '5-e-4', title: 'Memory in Marble' },
          { id: '5-e-5', title: 'My School Days' },
          { id: '5-e-6', title: 'The Clever Monkey' },
          { id: '5-e-7', title: 'The Rebel Poet' },
          { id: '5-e-8', title: 'Buildings to Remember' },
          { id: '5-e-9', title: 'Bird\'s Eye' },
          { id: '5-e-10', title: 'A Great Social Reformer' }
        ]
      },
      {
        id: 'math',
        name: 'गणित',
        icon: 'fa-plus',
        color: 'bg-blue-400',
        chapters: [
          { id: '5-m-1', title: 'बड़ी संख्याएं' },
          { id: '5-m-2', title: 'जोड़ और घटाव' },
          { id: '5-m-3', title: 'गुणा और भाग' },
          { id: '5-m-4', title: 'गुणनखंड और गुणज' },
          { id: '5-m-5', title: 'अभाज्य और भाज्य संख्याएं' },
          { id: '5-m-6', title: 'भिन्न की अवधारणा' },
          { id: '5-m-7', title: 'ज्यामितीय आकार' }
        ]
      },
      {
        id: 'env',
        name: 'पर्यावरण',
        icon: 'fa-tree',
        color: 'bg-green-500',
        chapters: [
          { id: '5-e-1', title: 'मानव शरीर: त्वचा और हड्डियां' },
          { id: '5-e-2', title: 'जीव जगत और विविधता' },
          { id: '5-e-3', title: 'पारिस्थितिकी तंत्र' },
          { id: '5-e-4', title: 'सामाजिक पर्यावरण' },
          { id: '5-e-5', title: 'पारंपरिक ज्ञान और संस्कृति' },
          { id: '5-e-6', title: 'जल संरक्षण' }
        ]
      }
    ]
  }
];