import type { OutputLanguage } from '../core/extraction/prompt';

/**
 * UI strings. Many users are stressed and reading in a second language: keep sentences
 * short and plain, and never word anything as legal advice.
 */
const tr = {
  'app.name': 'Mektup Asistanı',
  'home.title': 'Resmî mektubunu anla',
  'home.intro':
    'Almanya’dan gelen resmî bir mektubun fotoğrafını çek ya da PDF’ini seç. Sana kısa bir özet, son tarihler ve yapman gerekenleri gösteririz.',
  'home.takePhoto': 'Fotoğraf çek',
  'home.choosePhoto': 'Galeriden fotoğraf seç',
  'home.choosePdf': 'PDF seç',
  'home.pasteText': 'Metin yapıştır (test)',
  'home.language': 'Dil',
  'home.disclaimer':
    'Bu uygulama hukuki danışmanlık değildir. Sonuçlar hatalı olabilir. Önemli kararlardan önce her zaman orijinal mektuba bak ve gerekirse bir danışma merkezine sor.',
  'home.about': 'Gizlilik ve nasıl çalışır',
  'home.permissionDenied': 'Kameraya erişim izni verilmedi. Ayarlardan izin verebilirsin.',
  'home.tooLarge': 'Dosya çok büyük. Daha küçük bir fotoğraf ya da PDF dene.',
  'home.unsupported': 'Bu dosya türü desteklenmiyor. JPEG, PNG, HEIC ya da PDF kullan.',

  'analyzing.title': 'Mektup okunuyor…',
  'analyzing.body': 'Bu bir dakika kadar sürebilir.',

  'error.title': 'Bir sorun oluştu',
  'error.invalid_request': 'Dosya gönderilemedi. Lütfen tekrar dene.',
  'error.rate_limited':
    'Kısa sürede çok fazla mektup gönderildi. Lütfen bir saat sonra tekrar dene.',
  'error.unreadable_document': 'Mektupta okunabilir metin bulunamadı. Daha net bir fotoğraf dene.',
  'error.ocr_not_configured': 'Fotoğraf okuma henüz hazır değil. Şimdilik dijital bir PDF dene.',
  'error.extraction_failed': 'Mektup analiz edilemedi. Lütfen tekrar dene.',
  'error.service_unavailable': 'Servis şu an çok yoğun. Birkaç dakika sonra tekrar dene.',
  'error.not_configured': 'Servis henüz kurulmadı.',
  'error.network': 'İnternet bağlantısı yok ya da sunucuya ulaşılamıyor.',
  'error.invalid_response': 'Sunucudan beklenmeyen bir cevap geldi. Lütfen tekrar dene.',
  'error.retry': 'Başa dön',

  'result.title': 'Sonuç',
  'result.checkOriginal':
    'Bu bir yardımcı özettir, hukuki danışmanlık değildir. Her maddeyi orijinal mektupla karşılaştır.',
  'result.devMode':
    'Test modu: Bu kurulum sadece deneme mektupları içindir. Gerçek mektup yükleme.',
  'result.dropped': 'Mektubun bazı kısımları okunamadı ({count} madde gösterilemiyor).',
  'result.summary': 'Özet',
  'result.deadlines': 'Son tarihler',
  'result.actions': 'Yapman gerekenler',
  'result.none': 'Bulunamadı.',
  'result.unverified': 'Mektupta bulunamadı — mutlaka kontrol et',
  'result.lowConfidence': 'Emin değiliz — kontrol et',
  'result.mediumConfidence': 'Yorum gerekebilir — kontrol et',
  'result.relativeDeadline':
    'Mektupta kesin tarih yok. Tarih, mektubun sana ulaştığı güne göre değişir.',
  'result.showSource': 'Mektupta göster',
  'result.addToCalendar': 'Takvime ekle',
  'result.report': 'Yanlış mı?',
  'result.corrected': 'Senin düzeltmen',
  'result.newLetter': 'Yeni mektup',
  'result.calendarError': 'Takvim açılamadı.',

  'deadline.due_date': 'Son tarih',
  'deadline.appointment': 'Randevu',
  'deadline.expiry': 'Geçerlilik sonu',
  'deadline.recurring': 'Düzenli tarih',
  'deadline.relative': 'Süre',

  'action.required': 'Yapman gereken',
  'action.conditional': 'Sadece şu durumda',
  'action.optional': 'İsteğe bağlı',

  'source.title': 'Mektuptaki yeri',
  'source.notFound':
    'Bu madde için mektupta karşılık gelen metin bulunamadı. Bu bilgiye güvenmeden önce orijinal mektubu kontrol et.',
  'source.highlightLabel': 'İşaretli metin: {text}',
  'source.photoLabel': 'Mektubun fotoğrafı; ilgili yer sarıyla işaretli.',

  'report.title': 'Ne yanlış?',
  'report.intro':
    'Bize sadece hatanın türü gider. Mektubun içeriği ya da yazdığın düzeltme gönderilmez.',
  'report.wrong_date': 'Tarih yanlış',
  'report.wrong_amount': 'Tutar yanlış',
  'report.not_in_letter': 'Mektupta böyle bir şey yok',
  'report.wrong_meaning': 'Anlamı yanlış',
  'report.missing_detail': 'Önemli bir ayrıntı eksik',
  'report.other': 'Başka bir şey',
  'report.correctionLabel': 'Doğrusu (isteğe bağlı, sadece telefonunda kalır)',
  'report.submit': 'Gönder',
  'report.thanks': 'Teşekkürler! Düzeltmen bu ekranda gösteriliyor.',
  'report.sendFailed': 'Rapor gönderilemedi, ama düzeltmen telefonunda kaydedildi.',

  'about.title': 'Gizlilik ve nasıl çalışır',
  'about.body':
    'Mektubun metni okunur ve özetlenmek üzere AB’deki sunucumuza gönderilir. Fotoğraf ya da PDF saklanmaz; işlem bitince silinir. Sonuçlar sadece bu telefonda, uygulama açıkken tutulur.\n\nHer madde için mektuptaki ilgili cümleyi gösteririz. Bu cümle mektupta bulunamazsa uyarı veririz.\n\n“Yanlış mı?” ile bir hata bildirirsen sadece hatanın türü gönderilir (örneğin “tarih yanlış”). Mektubun içeriği, adın ya da adresin gönderilmez.\n\nBu uygulama hukuki danışmanlık değildir.',

  'calendar.notes': 'Mektup Asistanı ile eklendi. Lütfen orijinal mektuptaki tarihi kontrol et.',
} as const;

export type StringKey = keyof typeof tr;

const en: Record<StringKey, string> = {
  'app.name': 'Letter Assistant',
  'home.title': 'Understand your official letter',
  'home.intro':
    'Take a photo of an official German letter or choose its PDF. We show you a short summary, the deadlines and what you need to do.',
  'home.takePhoto': 'Take a photo',
  'home.choosePhoto': 'Choose a photo',
  'home.choosePdf': 'Choose a PDF',
  'home.pasteText': 'Paste text (test)',
  'home.language': 'Language',
  'home.disclaimer':
    'This app is not legal advice. Results can be wrong. Always check the original letter before important decisions, and ask an advice centre if needed.',
  'home.about': 'Privacy and how it works',
  'home.permissionDenied': 'Camera access was not allowed. You can allow it in Settings.',
  'home.tooLarge': 'The file is too large. Try a smaller photo or PDF.',
  'home.unsupported': 'This file type is not supported. Use JPEG, PNG, HEIC or PDF.',

  'analyzing.title': 'Reading your letter…',
  'analyzing.body': 'This can take about a minute.',

  'error.title': 'Something went wrong',
  'error.invalid_request': 'The file could not be sent. Please try again.',
  'error.rate_limited': 'Too many letters were sent in a short time. Please try again in an hour.',
  'error.unreadable_document': 'No readable text was found. Try a sharper photo.',
  'error.ocr_not_configured': 'Reading photos is not ready yet. For now, try a digital PDF.',
  'error.extraction_failed': 'The letter could not be analysed. Please try again.',
  'error.service_unavailable': 'The service is very busy. Try again in a few minutes.',
  'error.not_configured': 'The service is not set up yet.',
  'error.network': 'No internet connection, or the server cannot be reached.',
  'error.invalid_response': 'The server sent an unexpected answer. Please try again.',
  'error.retry': 'Start again',

  'result.title': 'Result',
  'result.checkOriginal':
    'This is a helper summary, not legal advice. Compare every item with the original letter.',
  'result.devMode': 'Test mode: this setup is for test letters only. Do not upload real letters.',
  'result.dropped': 'Parts of the letter could not be read ({count} items cannot be shown).',
  'result.summary': 'Summary',
  'result.deadlines': 'Deadlines',
  'result.actions': 'What you need to do',
  'result.none': 'None found.',
  'result.unverified': 'Not found in the letter — check this',
  'result.lowConfidence': 'We are not sure — check this',
  'result.mediumConfidence': 'May need interpretation — check this',
  'result.relativeDeadline':
    'The letter gives no exact date. The date depends on when the letter reached you.',
  'result.showSource': 'Show in letter',
  'result.addToCalendar': 'Add to calendar',
  'result.report': 'Wrong?',
  'result.corrected': 'Your correction',
  'result.newLetter': 'New letter',
  'result.calendarError': 'The calendar could not be opened.',

  'deadline.due_date': 'Deadline',
  'deadline.appointment': 'Appointment',
  'deadline.expiry': 'Expires',
  'deadline.recurring': 'Regular date',
  'deadline.relative': 'Time limit',

  'action.required': 'You need to',
  'action.conditional': 'Only if',
  'action.optional': 'Optional',

  'source.title': 'In the letter',
  'source.notFound':
    'We could not find matching text in the letter for this item. Check the original letter before relying on it.',
  'source.highlightLabel': 'Highlighted text: {text}',
  'source.photoLabel': 'Photo of the letter; the matching passage is marked in yellow.',

  'report.title': 'What is wrong?',
  'report.intro':
    'We only receive the type of error. The letter’s content and your correction are not sent.',
  'report.wrong_date': 'Wrong date',
  'report.wrong_amount': 'Wrong amount',
  'report.not_in_letter': 'This is not in the letter',
  'report.wrong_meaning': 'Wrong meaning',
  'report.missing_detail': 'An important detail is missing',
  'report.other': 'Something else',
  'report.correctionLabel': 'Correct version (optional, stays on your phone)',
  'report.submit': 'Send',
  'report.thanks': 'Thank you! Your correction is shown on this screen.',
  'report.sendFailed': 'The report could not be sent, but your correction is saved on your phone.',

  'about.title': 'Privacy and how it works',
  'about.body':
    'The text of your letter is read and sent to our server in the EU to be summarised. The photo or PDF is not stored; it is deleted when processing ends. Results are kept only on this phone while the app is open.\n\nFor every item we show the matching sentence in the letter. If that sentence cannot be found, we warn you.\n\nIf you report an error with “Wrong?”, only the type of error is sent (for example “wrong date”). The letter’s content, your name and your address are never sent.\n\nThis app is not legal advice.',

  'calendar.notes': 'Added by Letter Assistant. Please check the date in the original letter.',
};

const STRINGS: Record<OutputLanguage, Record<StringKey, string>> = { tr, en };

export function translate(
  language: OutputLanguage,
  key: StringKey,
  params: Record<string, string | number> = {},
): string {
  return STRINGS[language][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
