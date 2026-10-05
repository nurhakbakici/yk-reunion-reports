import type { FieldDef, FieldType, Lang, SectionDef, Template } from '../types';

// Built-in templates. They are read-only in the app; "Özelleştir" makes an
// editable copy. Field ids are positional (s0f1…), so keep new fields at the
// end of a section if saved reports should keep lining up after a change.

type FieldOpts = Omit<FieldDef, 'id' | 'type' | 'label'>;

const f = (type: FieldType, label: string, opts: FieldOpts = {}): Omit<FieldDef, 'id'> => ({
  type,
  label,
  ...opts,
});

function sections(defs: [string, Omit<FieldDef, 'id'>[]][]): SectionDef[] {
  return defs.map(([title, fields], si) => ({
    id: `s${si}`,
    title,
    fields: fields.map((field, fi) => ({ id: `s${si}f${fi}`, ...field })),
  }));
}

const base = { builtin: true, updatedAt: 0, lang: 'tr' } as const;

export const BUILTIN_TEMPLATES: Template[] = [
  {
    ...base,
    id: 'builtin-gorev',
    name: 'Görev Raporu',
    description: 'Oturum sonrası görev raporu. Her departman için uygun genel şablon.',
    theme: 'konsol',
    accent: '#3fd0c9',
    issuer: 'Görev Kayıt Sistemi',
    emblem: 'ankh',
    docTitle: 'Görev Raporu',
    codePrefix: 'GRV',
    classification: 'hizmete-ozel',
    sections: sections([
      [
        'Görev Künyesi',
        [
          f('date', 'Tarih', { width: 'third' }),
          f('text', 'Konum', { width: 'twothirds', source: 'locations' }),
          f('text', 'Sorumlu Departman', { width: 'half', source: 'departments' }),
          f('text', 'Görevi Veren', { width: 'half' }),
          f('select', 'Görev Sonucu', {
            width: 'half',
            options: ['Başarılı', 'Kısmen Başarılı', 'Başarısız', 'İptal Edildi', 'Devam Ediyor'],
          }),
          f('scale', 'Tehdit Seviyesi', { width: 'half', max: 5 }),
        ],
      ],
      [
        'Görev Ekibi',
        [f('table', 'Katılan Personel', { columns: ['Ad Soyad', 'Departman / Kurum', 'Görevi', 'Durumu'] })],
      ],
      ['Görevin Amacı', [f('longtext', 'Amaç', { placeholder: 'Ekip neden gönderildi, ne bekleniyordu?' })]],
      [
        'Olayların Özeti',
        [
          f('longtext', 'Özet', {
            placeholder: 'Olayları sırasıyla anlat. **kalın**, ||sansürlü|| ve "- " ile madde kullanabilirsin.',
          }),
        ],
      ],
      ['Bulgular', [f('list', 'Elde Edilenler ve Tespitler', { placeholder: 'Her satıra bir madde' })]],
      ['Kayıplar ve Hasar', [f('longtext', 'Yaralanmalar, kayıplar, hasar gören ekipman')]],
      ['Öneriler', [f('longtext', 'Öneriler ve Açık Kalan Konular')]],
      [
        'Onay',
        [
          f('signature', 'Raporu Hazırlayan', { width: 'half' }),
          f('signature', 'Onaylayan', { width: 'half' }),
        ],
      ],
    ]),
  },
  {
    ...base,
    id: 'builtin-guvenlik',
    name: 'Güvenlik Olay Tutanağı',
    description: 'Atlas / Jurisdiction Force asayiş tutanağı. Müdahale kademesi angajman kurallarına göre.',
    theme: 'evrak',
    accent: '#a3271f',
    issuer: 'Atlas Güvenlik Şirketi — Ultimi Cadere',
    emblem: 'shield',
    docTitle: 'Olay Tutanağı',
    codePrefix: 'ATL',
    classification: 'gizli',
    sections: sections([
      [
        'Olay Bilgisi',
        [
          f('select', 'Olay Türü', {
            width: 'half',
            options: [
              'Kavga / Darp',
              'Hırsızlık',
              'Yetkisiz Erişim',
              'Kaynak Dağıtım İhlali',
              'Karantina İhlali',
              'Sabotaj Şüphesi',
              'Kayıp Kişi',
              'Diğer',
            ],
          }),
          f('date', 'Tarih / Saat', { width: 'half' }),
          f('text', 'Konum', { width: 'half', source: 'locations' }),
          f('text', 'Müdahale Eden Manga', { width: 'half', source: 'squads' }),
          f('select', 'Müdahale Kademesi', {
            width: 'half',
            options: ['1 — Sözlü', '2 — Elle', '3 — Şok', '4 — Silah'],
          }),
          f('select', 'Dosya Durumu', {
            width: 'half',
            options: ['Açık', 'Soruşturma Sürüyor', 'Yönetime Sevk Edildi', 'Kapatıldı'],
          }),
        ],
      ],
      [
        'İlgili Kişiler',
        [f('table', 'Kişiler', { columns: ['Ad Soyad', 'Köken', 'Departman', 'Sıfatı'] })],
      ],
      ['Olayın Anlatımı', [f('longtext', 'Anlatım', { placeholder: 'Ne oldu, kim gördü, nasıl müdahale edildi?' })]],
      [
        'Deliller',
        [
          f('list', 'Deliller ve Kayıtlar', { width: 'half', placeholder: 'Her satıra bir delil' }),
          f('image', 'Görsel Kayıt', { width: 'half' }),
        ],
      ],
      ['Sonuç', [f('longtext', 'Alınan Önlemler ve Karar')]],
      [
        'İmza',
        [
          f('signature', 'Tutanağı Düzenleyen', { width: 'half' }),
          f('signature', 'Manga Subayı', { width: 'half' }),
        ],
      ],
    ]),
  },
  {
    ...base,
    id: 'builtin-tibbi',
    name: 'Tıbbi Değerlendirme',
    description: 'Revir kabul ve muayene raporu; stres düzeyi ve görev uygunluğu ile.',
    theme: 'kurumsal',
    accent: '#17806a',
    issuer: 'Sağlık Birimi',
    emblem: 'cross',
    docTitle: 'Tıbbi Değerlendirme Raporu',
    codePrefix: 'TIB',
    classification: 'hizmete-ozel',
    sections: sections([
      [
        'Hasta',
        [
          f('text', 'Ad Soyad', { width: 'half' }),
          f('text', 'Köken', { width: 'half', source: 'origins' }),
          f('text', 'Departman', { width: 'half', source: 'departments' }),
          f('date', 'Kabul Tarihi', { width: 'half' }),
          f('text', 'Kabul Yeri', {
            width: 'half',
            options: [
              'A Çemberi — Poliklinik',
              'A Çemberi — Revir',
              'B Çemberi — Revir',
              'B Çemberi — Cerrahi Birim',
              'Saha Müdahalesi',
            ],
          }),
          f('select', 'Yara Durumu', { width: 'half', options: ['Yok', 'Hafif', 'Ciddi', 'Kritik'] }),
        ],
      ],
      [
        'Muayene',
        [
          f('longtext', 'Şikâyet / Olay'),
          f('longtext', 'Bulgular ve Tanı'),
          f('scale', 'Stres Düzeyi', { width: 'half', max: 10 }),
          f('select', 'Kriyo Sonrası Uyum', {
            width: 'half',
            options: ['Sorunsuz', 'Hafif Belirtiler', 'İzlem Gerekli', 'Uyum Bozukluğu'],
          }),
        ],
      ],
      [
        'Tedavi',
        [
          f('longtext', 'Uygulanan Tedavi'),
          f('table', 'Kullanılan İlaç ve Malzeme', { columns: ['Malzeme', 'Doz / Miktar', 'Not'] }),
        ],
      ],
      [
        'Karar',
        [
          f('select', 'Görev Uygunluğu', {
            width: 'half',
            options: ['Göreve Uygun', 'Kısıtlı Görev', 'İstirahat', 'Gözlem Altında', 'Kriyo Önerilir'],
          }),
          f('date', 'Kontrol Tarihi', { width: 'half' }),
          f('longtext', 'Hekim Notu'),
          f('signature', 'Sorumlu Hekim', { width: 'half' }),
        ],
      ],
    ]),
  },
  {
    ...base,
    id: 'builtin-teknik',
    name: 'Arıza ve Bakım Kaydı',
    description: 'Teknik Departman arıza bildirimi, kök neden ve onarım kaydı.',
    theme: 'konsol',
    accent: '#f0a23b',
    issuer: 'Teknik Departman — Bakım Kayıt',
    emblem: 'gear',
    docTitle: 'Arıza ve Bakım Kaydı',
    codePrefix: 'TKN',
    classification: 'acik',
    sections: sections([
      [
        'Arıza Bilgisi',
        [
          f('text', 'Sistem / Ekipman', { width: 'half', placeholder: 'Örn. Su pompası P-14' }),
          f('text', 'Konum', { width: 'half', source: 'locations' }),
          f('date', 'Bildirim Tarihi', { width: 'third' }),
          f('text', 'Bildiren', { width: 'third' }),
          f('select', 'Durum', {
            width: 'third',
            options: ['Açık', 'Geçici Çözüm', 'Parça Bekliyor', 'Onarıldı', 'İzlemede'],
          }),
          f('scale', 'Öncelik', { width: 'half', max: 5 }),
          f('select', 'Etkilenen Alan', {
            width: 'half',
            options: ['Tek Bölme', 'Çeyrek', 'Çemberin Tamamı', 'Omurga', 'Gemi Geneli'],
          }),
        ],
      ],
      ['Belirti', [f('longtext', 'Gözlenen Belirti')]],
      ['Kök Neden', [f('longtext', 'Tespit Edilen Neden')]],
      [
        'Onarım',
        [
          f('longtext', 'Yapılan İşlem'),
          f('table', 'Kullanılan Parça ve Malzeme', { columns: ['Parça', 'Adet', 'Stok Kodu'] }),
        ],
      ],
      ['Takip', [f('list', 'Takip İşleri', { placeholder: 'Her satıra bir iş' })]],
      [
        'İmza',
        [
          f('signature', 'Teknisyen', { width: 'half' }),
          f('signature', 'Vardiya Amiri', { width: 'half' }),
        ],
      ],
    ]),
  },
  {
    ...base,
    id: 'builtin-bilim',
    name: 'Bilimsel Analiz Raporu',
    description: 'Numune, deney ve gözlem raporu. Bilim ve Kaynak Yönetimi için.',
    theme: 'kurumsal',
    accent: '#3d5fd9',
    issuer: 'Bilim ve Kaynak Yönetimi — Laboratuvar',
    emblem: 'atom',
    docTitle: 'Analiz Raporu',
    codePrefix: 'BLM',
    classification: 'hizmete-ozel',
    sections: sections([
      [
        'Numune',
        [
          f('text', 'Numune Kodu', { width: 'third' }),
          f('date', 'Tarih', { width: 'third' }),
          f('scale', 'Tehlike Sınıfı', { width: 'third', max: 5 }),
          f('text', 'Numunenin Kaynağı', { width: 'half', placeholder: 'Nereden, kim tarafından alındı?' }),
          f('text', 'Laboratuvar', {
            width: 'half',
            options: [
              'A Çemberi — Eğitim Laboratuvarı',
              'C Çemberi — Deney Odası',
              'C Çemberi — Genetik ve DNA Veri Odası',
              'C Çemberi — Acil Müdahale Veteriner Odası',
              'Saha',
            ],
          }),
        ],
      ],
      ['Yöntem', [f('longtext', 'Uygulanan Yöntem')]],
      [
        'Gözlemler',
        [
          f('longtext', 'Gözlemler', { width: 'twothirds' }),
          f('image', 'Görsel', { width: 'third' }),
          f('table', 'Ölçümler', { columns: ['Parametre', 'Değer', 'Birim', 'Not'] }),
        ],
      ],
      ['Sonuç', [f('longtext', 'Değerlendirme')]],
      ['Öneriler', [f('list', 'Öneriler', { placeholder: 'Her satıra bir öneri' })]],
      ['İmza', [f('signature', 'Sorumlu Araştırmacı', { width: 'half' })]],
    ]),
  },
  {
    ...base,
    id: 'builtin-personel',
    name: 'Personel Dosyası',
    description: 'Karakter / NPC sicil dosyası: fotoğraf, köken, departman ve notlar.',
    theme: 'evrak',
    accent: '#2b4a70',
    issuer: 'Yönetim ve Genel Hizmetler — Sicil',
    emblem: 'ankh',
    docTitle: 'Personel Dosyası',
    codePrefix: 'PRS',
    classification: 'hizmete-ozel',
    sections: sections([
      [
        'Kimlik',
        [
          f('image', 'Fotoğraf', { width: 'third' }),
          f('text', 'Ad Soyad', { width: 'twothirds' }),
          f('text', 'Köken', { width: 'twothirds', source: 'origins' }),
          f('text', 'Departman', { width: 'twothirds', source: 'departments' }),
          f('text', 'Bağlı Kurum', { width: 'twothirds', source: 'orgs' }),
        ],
      ],
      [
        'Görev',
        [
          f('text', 'Unvan / Görev', { width: 'half' }),
          f('select', 'Kriyo Durumu', { width: 'half', options: ['Uyanık', 'Kriyoda', 'Dönüşümlü Vardiya'] }),
          f('text', 'Görev Yeri', { width: 'half', source: 'locations' }),
          f('scale', 'Yetki Seviyesi', { width: 'half', max: 5 }),
        ],
      ],
      ['Özgeçmiş', [f('longtext', 'Özgeçmiş')]],
      ['Yetkinlikler', [f('list', 'Eğitim ve Beceriler', { placeholder: 'Her satıra bir madde' })]],
      ['Notlar', [f('longtext', 'Sicil Notları', { placeholder: 'Gizli kalması gerekeni ||iki çizgi arasına|| yaz.' })]],
      ['Onay', [f('signature', 'Sicil Memuru', { width: 'half' })]],
    ]),
  },
  {
    ...base,
    id: 'builtin-sorusturma',
    name: 'Stellars Soruşturma Dosyası',
    description: 'Yıldız Cemiyeti yargı ve asayiş kanadının soruşturma dosyası.',
    theme: 'evrak',
    accent: '#5f4596',
    issuer: 'Yıldız Cemiyeti — Stellars',
    emblem: 'star',
    docTitle: 'Soruşturma Dosyası',
    codePrefix: 'YLD',
    classification: 'cok-gizli',
    sections: sections([
      [
        'Dosya',
        [
          f('date', 'Açılış Tarihi', { width: 'third' }),
          f('text', 'Soruşturmacı', { width: 'third' }),
          f('select', 'Durum', {
            width: 'third',
            options: ['Ön İnceleme', 'Soruşturma', 'Hüküm Aşaması', 'Kapandı'],
          }),
          f('text', 'Yetki Dayanağı', { placeholder: 'Hangi antlaşma, direktif veya başvuruya dayanıyor?' }),
        ],
      ],
      ['İddia', [f('longtext', 'Soruşturmanın Konusu')]],
      [
        'İfadeler',
        [f('table', 'Tanık ve Taraf İfadeleri', { columns: ['Kişi', 'İfade Özeti', 'Güvenilirlik'] })],
      ],
      ['Bulgular', [f('longtext', 'Bulgular')]],
      ['Hüküm', [f('longtext', 'Hüküm / Tavsiye')]],
      [
        'İmza',
        [
          f('signature', 'Stellar', { width: 'half' }),
          f('signature', 'Astel Müfettişi', { width: 'half' }),
        ],
      ],
    ]),
  },
  {
    ...base,
    id: 'builtin-duyuru',
    name: 'Gemi Duyurusu',
    description: 'Mürettebata yayınlanan resmi duyuru. Oyun yöneticileri için kullanışlı.',
    theme: 'konsol',
    accent: '#e6c545',
    issuer: 'Kontrol Bölgesi — Genel Yayın',
    emblem: 'ankh',
    docTitle: 'Gemi Duyurusu',
    codePrefix: 'DYR',
    classification: 'acik',
    sections: sections([
      [
        'Yayın',
        [
          f('date', 'Yayın Tarihi', { width: 'third' }),
          f('text', 'Kimden', { width: 'third', source: 'departments' }),
          f('select', 'Öncelik', { width: 'third', options: ['Bilgi', 'Önemli', 'Acil'] }),
          f('text', 'Kime', { placeholder: 'Örn. Tüm uyanık mürettebat' }),
        ],
      ],
      ['Duyuru', [f('longtext', 'Metin')]],
      ['Yapılması Gerekenler', [f('list', 'Talimatlar', { placeholder: 'Her satıra bir talimat' })]],
      ['Onay', [f('signature', 'Yayınlayan', { width: 'half' })]],
    ]),
  },
  {
    ...base,
    id: 'builtin-kisisel',
    name: 'Kişisel Kayıt',
    description: 'Karakterinin günlüğü: resmi olmayan, şifreli kişisel kayıt.',
    theme: 'amber',
    accent: '#ffb347',
    issuer: 'Kişisel Kayıt — Şifreli Depolama',
    emblem: 'none',
    docTitle: 'Kişisel Kayıt',
    codePrefix: 'LOG',
    classification: 'none',
    sections: sections([
      [
        'Kayıt',
        [
          f('text', 'Kayıt Sahibi', { width: 'half' }),
          f('date', 'Tarih', { width: 'half' }),
          f('text', 'Konum', { width: 'half', source: 'locations' }),
          f('text', 'Ruh Hali', { width: 'half' }),
        ],
      ],
      ['Günlük', [f('longtext', 'Kayıt', { placeholder: 'Bugün ne oldu?' })]],
      ['Kendime Not', [f('list', 'Unutma', { placeholder: 'Her satıra bir not' })]],
    ]),
  },
];

export function blankTemplate(id: string, name: string, lang: Lang): Template {
  const tr = lang === 'tr';
  return {
    id,
    name,
    description: '',
    theme: 'konsol',
    accent: '#3fd0c9',
    issuer: '',
    emblem: 'ankh',
    docTitle: name,
    codePrefix: 'DOC',
    classification: 'none',
    lang,
    updatedAt: Date.now(),
    sections: [
      {
        id: 's0',
        title: tr ? 'Bilgiler' : 'Details',
        fields: [
          { id: 's0f0', type: 'date', label: tr ? 'Tarih' : 'Date', width: 'half' },
          { id: 's0f1', type: 'text', label: tr ? 'Konum' : 'Location', width: 'half', source: 'locations' },
        ],
      },
      {
        id: 's1',
        title: tr ? 'İçerik' : 'Content',
        fields: [{ id: 's1f0', type: 'longtext', label: tr ? 'Metin' : 'Text' }],
      },
    ],
  };
}
