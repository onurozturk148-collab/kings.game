# KINGS — 2D Bannerlord-tarzı kampanya haritası (v0.9)

Tamamen vanilla JavaScript + HTML5 Canvas ile yazıldı, hiçbir dış kütüphane
kullanmıyor. Piksel-art dokular Python/Pillow ile üretildi
(`generate_assets.py`). Bu, hem tarayıcıda oynanabilir bir demo olarak hem de
ileride **Capacitor** ile paketlenip Play Store'a atılabilecek bir temel
olarak tasarlandı.

## Şu an neler var

**v0.1 — "dünya haritası + ordu hareketi"**
- Prosedürel olarak üretilmiş harita: çayır, ova, orman, tepe, dağ, su
  biyomları (deterministic seed → her açılışta aynı harita).
- Klavye (WASD / ok tuşları) ve dokunmatik joystick ile ordu hareketi.
- Arazi tipine göre değişen hareket hızı (dağ/orman yavaş, yol hızlı, su
  geçilemez).
- Bannerlord tarzı gerçek-zamanlı takvim/saat sistemi (duraklat: boşluk
  tuşu ya da sağ üstteki buton).
- Köy / kasaba / kale yerleşimleri, isimleriyle haritada görünüyor;
  yaklaşınca "dokun / E" ile basit bir bilgi ekranı açılıyor (pazar, görev
  vb. gelecek eklentilerin yer tutucusu).
- Gündüz/gece geçişi (ekran tonlaması).
- `localStorage` ile basit konum/zaman kaydı (aynı tarayıcıda devam et).

**v0.2 — büyütme ve ince ayar**
- Oyuncu artık bayrak değil, kalkanlı/kılıçlı bir **insan figürü** (piksel
  art, sağa/sola dönünce yansıyor).
- Harita 72×72'den **168×168**'e büyüdü.
- Fare tekerleği ve **iki parmakla pinch-zoom** ile haritada
  yakınlaşma/uzaklaşma (dokunmatikte iki parmakla harita üzerinde yap).
- Çok daha fazla yerleşim: 9 kale, 14 kasaba, 34 köy (öncesinde 3/4/9).
- Harita kenarına çok uzaklaşıldığında ekranın geri kalanı artık siyah
  boşluk değil, "bilinmeyen diyar" tonunda lacivert bir dolgu gösteriyor.

**v0.3 — fare ile hareket, hız kontrolü, krallıklar, şehir menüleri**
- **Fare sol tık ile hareket**: artık haritada tıkladığın yere ordu
  otomatik yürüyor (hedef noktada nabız gibi atan bir işaret var). WASD/ok
  tuşları ve dokunmatik joystick de hâlâ çalışıyor — hangisi kullanılırsa
  o geçerli oluyor.
- **1x / 2x / 3x hız** düğmeleri (üst çubukta) — hem hareketi hem takvimi
  hızlandırıyor. Klavyede `1`, `2`, `3` tuşlarıyla da değiştirilebiliyor.
  Temel hareket hızı da belirgin şekilde arttırıldı.
- Takvim 1257 yılına (Orta Çağ) çekildi, başlangıç ekranına kısa bir arka
  plan cümlesi eklendi.
- **5 krallık** eklendi (Kızılkartal, Gökyele, Yeşilorman, Morkale,
  Demirtaç) — her biri kendi rengiyle. Kaleler/kasabalar/köyler coğrafi
  olarak en yakın krallığa aitler (harita üzerinde renkli küçük
  bayraklarla gösteriliyor), böylece krallıkların toprakları haritada
  birbirinden ayrı bölgeler olarak görünüyor.
- **Şehir/köy/kale menüsü**: artık yerleşime girince placeholder yerine 3
  gerçek seçenek var:
  - **Ticaret** — 5 mal (buğday, demir, kumaş, şarap, baharat), gerçek
    altın ekonomisiyle al/sat.
  - **Ordu Topla** — yerleşim tipine göre değişen asker tipiyle (köylü
    asker / piyade / atlı asker) altın karşılığı asker topluyorsun.
  - **Köylülerle Konuş** — rastgele bir NPC (isim + kısa replik) ile
    karşılaşıyorsun; ilk NPC entegrasyonu, ileride görev sistemine
    genişleyecek.
- Oyuncunun altını ve ordu sayısı artık üst HUD'da sürekli görünüyor.

**v0.4 — ayırt edilebilir yerleşimler, 7 krallık, kamera pan, canlı NPC'ler**
- **Kale / kasaba / köy artık görsel olarak tamamen farklı**: kale sadece
  surlar + iki kule + bayraklardan oluşan saf bir kaleye benzeşecek şekilde
  yeniden çizildi (hiç ev yok); kasaba tam çevresi surlarla kaplı, içeride
  birden fazla çatı görünen bir şehir; köy ise surlar olmadan birkaç küçük
  kulübeden ibaret. İsim yazı boyutu da türe göre değişiyor (kale en büyük,
  köy en küçük), böylece haritada bir bakışta ayırt edilebiliyorlar.
- Harita 168×168'den **210×210**'a büyütüldü, yerleşim sayıları da buna
  göre arttı (13 kale / 20 kasaba / 48 köy) — tüm yerleşim isimleri artık
  benzersiz (isim havuzları genişletildi).
- **7 krallık**: Kızılkartal, Gökyele, Yeşilorman, Morkale, Demirtaç,
  Kumkale, Sisçelik — her birinin kendine has rengi var. Yerleşim
  **isimlerinin yazı rengi artık doğrudan krallığın rengi** (üstteki küçük
  bayrağa ek olarak), böylece hangi krallığa ait olduğunu okumadan,
  renkten anlayabiliyorsun.
- **Haritada kaydırma (pan)**: fareyle bas-sürükle artık kamerayı
  kaydırıyor (tıklama ile hareket etme hâlâ çalışıyor — küçük bir
  sürükleme "tık", büyük bir sürükleme "kaydırma" sayılıyor). Ordu
  hareket etmeye başladığında kamera otomatik olarak yine onu takip
  etmeye dönüyor.
- **Canlı NPC'ler eklendi** — artık harita boş değil:
  - **Tüccar kervanları**: şehirden şehire, köyden köye kendi başlarına
    dolaşıp bir yerleşimde durup (alışveriş yapıyormuş gibi bir süre
    bekleyip) sonra başka bir yerleşime gidiyorlar. Küçük bir kağnı/araba
    ikonuyla gösteriliyorlar.
  - **Lordlar/ordular**: her krallığın kendi atlı, bayraklı lordları var,
    kendi krallıklarının toprakları içindeki yerleşimler arasında
    dolaşıyorlar, üstlerinde kaç askerleri olduğu bilgisi tutuluyor (şu an
    sadece veri — savaş sistemi gelince anlam kazanacak).
  - Bu ilk NPC simülasyonu; henüz oyuncuyla etkileşime girmiyorlar (o,
    savaş sistemiyle birlikte gelecek).

**v0.5 — gerçek yol bulma, savaş sistemi, eşkıyalar, gerçek duraklatma**
- **A\* yol bulma**: tıklayıp/dokunup gidilen her nokta artık gerçek bir
  algoritma ile hesaplanıyor — ordu artık suya/dağa doğru gidip takılı
  kalmıyor, engellerin etrafından dolanarak en kısa yolu buluyor (NPC'ler de
  aynı sistemi kullanıyor).
- **Yerleşimlere doğrudan tıkla/dokun ile gir**: artık yaklaşıp E'ye basmak
  zorunda değilsin — haritada uzaktan bir şehre/kaleye/köye tıkladığında ordu
  otomatik oraya yürüyor ve varınca kendiliğinden içeri giriyor. Menü artık
  ekranın **sol tarafında** açılıyor (E tuşu ve yaklaşınca çıkan "dokun"
  uyarısı da hâlâ çalışıyor, isteğe bağlı).
- **Yerleşim ikonları büyütüldü ve boy sıralaması netleşti**: kasabalar en
  büyük/en belirgin, kaleler orta, köyler en küçük — haritada bir bakışta
  hangisinin ne olduğu anlaşılıyor.
- **Gerçek duraklatma**: oyun duraklatıldığında artık sadece takvim değil,
  oyuncu da, bütün NPC'ler de tamamen donuyor — "zaman durdu" mantığı.
- **Eşkıyalar (kaçakçılar)** haritada rastgele dolaşıyor, tüccarlara ve
  oyuncuya saldırıyorlar (5-40 kişilik gruplar halinde). Oyuncuyu
  yakaladıklarında savaş ekranı açılıyor.
- **Savaş sistemi (ilk sürüm)**: kendi ordunu (piyade/okçu/süvari dağılımını)
  gördüğün bir "Pusu!" ekranından "Savaşı Başlat"a basıyorsun — düşmanın
  gerçek sayısı/konuşlanması savaş bitene kadar gizli kalıyor. Kısa bir
  "çarpışılıyor" bekleyişinin ardından sonuç ekranı geliyor: kayıplar,
  kazanırsan ganimet (kalkan/mızrak/kılıç/zırh — bunlar pazarda satılabiliyor,
  eşkıya grubunun büyüklüğüne göre değişiyor). Kaybedersen **tutsak
  alınıyorsun** ve bir süre sonra otomatik olarak kaçıp oyuna geri dönüyorsun.
- **3 asker tipi**: Piyade / Okçu / Süvari — her birinin maliyeti, gücü ve "ne
  işe yarar" açıklaması var; hangi yerleşimde hangisinin toplanabileceği de
  farklı (köyde sadece piyade, kalede hepsi).
- Kayıt sistemi asker sayısını artık tip tip (piyade/okçu/süvari) saklıyor.

**v0.6 — büyük/net semboller, gerçek ticaret, kervanlar, eşkıyaya saldırma**
- **Yerleşim ikonları ve isim yazıları belirgin şekilde büyütüldü** (kasaba
  ~%40, kale ~%37, köy ~%43 daha büyük) — haritada uzaktan bile hangi
  yerleşimin ne olduğu ve adı net okunuyor.
- **Gerçek, değişken ticaret ekonomisi**: artık her mal her yerleşimde farklı
  fiyata alınıp satılıyor (bir köyde ucuz olan başka bir kasabada pahalı
  olabiliyor) ve fiyatlar takvim ilerledikçe **sürekli dalgalanıyor** —
  Bannerlord'daki gibi "ucuza al, taşı, pahalıya sat" gerçek bir strateji
  haline geldi. Alış fiyatı her zaman satış fiyatından biraz yüksek (gerçekçi
  kâr marjı).
- **Kervan oluşturma**: her yerleşim menüsüne yeni bir seçenek eklendi.
  **Ucuz Kervan** (1300 altın, 20 birlik) veya **Büyük Kervan** (2000 altın,
  40 birlik) kurabiliyorsun — kervan tıpkı NPC tüccarlar gibi şehirler
  arasında kendi başına dolaşıp "ticaret" yapıyor ve her durakta sana pasif
  altın kazandırıyor (yatırdığın birlik sayısına göre). Kervanlar da
  eşkıyalar tarafından soyulabiliyor, tıpkı normal tüccarlar gibi.
- **Artık eşkıyalara biz de saldırabiliyoruz**: haritada bir kaçakçıya
  tıklarsan/dokunursan ordun ona doğru gidip (hedef kırmızı bir halkayla
  işaretlenir) yakalayınca savaş otomatik başlıyor — artık sadece onlar bize
  değil, biz de onlara saldırabiliyoruz.
- **Savaş sonrası ganimeti Bannerlord gibi tek tek seçiyoruz**: zafer
  sonrasında artık her eşya otomatik envantere girmiyor; ayrı bir "Ganimet"
  ekranında düşen her parçayı (kılıç, zırh, mızrak, kalkan...) tek tek "Al"
  diyerek seçiyorsun, istersen "Tümünü Al" ile hepsini birden alabiliyorsun.

**v0.7 — gerçek savaş menüsü (birlik dizme), tutsakken dünya akıyor**
- **Savaş artık "başlat, hemen bitti" değil**: pusu ekranında artık her
  birlik tipini (piyade/okçu/süvari) **Ön / Orta / Arka** olarak kendin
  diziyorsun. Doğru dizilim (piyade önde, okçu arkada, süvari ortada) gerçek
  bir savaş bonusu veriyor, yanlış dizilim ceza — yani "Savaşı Başlat"a
  basmadan önce verdiğin karar sonucu gerçekten etkiliyor. Savaş sırasında
  da artık tek bir "Savaşılıyor..." yazısı değil, birkaç saniye boyunca
  değişen çarpışma repliklerini ("Piyaden ileri atılıyor", "Okçuların oku
  düşman saflarını dövüyor" vb.) görüyorsun.
- **Tutsak alındığında artık dünya durmuyor**: kaçmayı beklediğin süre
  boyunca takvim akıyor, tüccarlar/kervanlar/lordlar hareket etmeye devam
  ediyor — sadece sen (oyuncu) o süre boyunca hareket edemiyorsun. Süre
  dolunca otomatik kaçıp oyuna geri dönüyorsun.
- Bununla birlikte gerçek bir hata da düzeltildi: seni yakalayan kaçakçı
  savaştan sonra (kazansan da kaybetsen de) hâlâ yanı başındaysa, dünya
  tekrar aktif olur olmaz seni anında bir daha yakalayabiliyordu — artık
  temas sonrası her kaçakçının birkaç saniyelik bir "soğuma" süresi var.

**v0.8 — gerçek savaş alanı (ızgara üzerinde birlik dizme + canlı çarpışma), dev şehirler, kalabalık harita**
- **Savaş menüsü artık tam ekran bir savaş alanı**: pusu anında ayrı bir
  ekran açılıyor. Ordun, alt sıradaki "tepsi"de küçük birlik jetonlarına
  (her biri birkaç askerlik bir "takım") bölünüyor — jetona dokunup
  seçiyorsun, sonra kendi bölgendeki (ızgaranın alt 3 sırası) bir hücreye
  dokunup oraya yerleştiriyorsun. Yanlış yere koyduysan tekrar dokunup
  geri alıp başka yere koyabiliyorsun — tam istenen "tek tek seç, dokunarak
  yerleştir" akışı. Elini çabuk tutmak istemeyenler için "Otomatik Diz"
  butonu kalan birlikleri ideal sıraya (piyade ön, okçu arka, süvari orta)
  otomatik diziyor. Düşmanın birlikleri de ızgarada görünüyor ama savaş
  başlayana kadar sayıları "?" ile gizli kalıyor.
- **Çarpışma artık canlı oynuyor**: "Savaşı Başlat"a basınca sonuç hemen
  hesaplanıyor (dizilimin gerçek bonus/ceza etkisi hâlâ geçerli, artık her
  bir takım için ayrı ayrı) ama ekrana hemen yazılmıyor — bunun yerine ön
  saflar ortada birbirine yaklaşıp çarpışıyor, okçular karşı tarafa gerçek
  ok/mızrak animasyonlarıyla atış yapıyor, kayıplar zaman içinde sayılar
  düşerek görünüyor, alttaki bant da değişen çarpışma repliklerini
  göstermeye devam ediyor. Yani artık "başlat basıyosun, başlıyo, yenildin
  diyo" değil, birkaç saniye süren gerçek bir 2D kuşbakışı çarpışma var.
- **Şehirler (ve kaleler, köyler) çok daha büyük**: özellikle kasabalar artık
  haritada gözden kaçmayacak kadar iri ve altın bir parıltıyla çevrili;
  kaleler ve köyler de büyütüldü, boyut hiyerarşisi (kasaba > kale > köy)
  daha da belirginleşti.
- **Haritada daha çok insan var**: tüccar, lord ve eşkıya sayıları artırıldı;
  ayrıca her yerleşimin (özellikle kasabaların) etrafında yerleşimi canlı
  gösteren küçük, dekoratif bir "halk kalabalığı" eklendi.

**v0.9 — savaş alanı baştan yazıldı: kare yok, açık alan + kendi kendine yürüyüp savaşan askerler**
- **Artık gerçekten "kareler içine değil, açık bomboş bir alan"**: pusu
  ekranı, harita gibi ama küçük, tamamen açık dikdörtgen bir savaş alanı.
  Alt sıradaki tepsiden bir birlik seçip kendi bölgende (alanın alt kısmı)
  *tam istediğin noktaya* dokunup bırakıyorsun — hiçbir kareye
  yapışmıyor, tıpkı kampanya haritasında bir yere gitmek gibi. Yanlış
  koyduysan üstüne tekrar dokunup geri tepsiye alabiliyorsun.
- **Askerler artık kendi başlarına yürüyüp savaşıyor**: "Savaşı Başlat"a
  basar basmaz her birlik canlı bir birim oluyor — en yakın düşman
  birliğine kendi kendine yürüyor, süvari daha hızlı koşuyor, okçular
  menzile girince duruyor ve düşmana gerçek ok animasyonlarıyla ateş
  ediyor, göğüs göğüse çarpışan birlikler birbirini eritene kadar
  dövüşmeye devam ediyor. Kaybeden takımlar dağılıyor, ekranın altındaki
  canlı olay akışında bunu görüyorsun ("Piyade takımımız dağıldı",
  "Bir kaçakçı takımı dağıldı!" gibi). Savaşın sonucu artık önceden zar
  atılıp sonra gösterilen bir şey değil — gerçekten o an alan üzerinde
  olanların sonucu.
- Her birlik, birkaç askerden oluşan küçük bir "asker kümesi" olarak
  çiziliyor (piyade mavi kalkanlı, okçu yeşil yaylı, süvari at üstünde
  turuncu) — düşman sayıları savaş başlayana kadar gizli siluetler olarak
  görünüyor, savaş başlayınca gerçek sayılar ortaya çıkıyor.
- Dizilim bonusu hâlâ geçerli (piyadeyi öne, okçuyu arkaya, süvariyi
  ortaya koymak gerçek bir güç avantajı veriyor) ama artık üç sabit bant
  yerine tam konuma göre sürekli (continuous) hesaplanıyor — ne kadar
  yerinde durursa o kadar bonus.
- Savaş, bir taraf tamamen dağılınca hemen bitiyor (beklemek yok); çok
  uzayan nadir durumlar için 26 saniyelik bir güvenlik sınırı da var.

## Yerelde çalıştırma

Tarayıcılar güvenlik nedeniyle `file://` üzerinden modül/fetch isteklerini
kısıtlayabildiği için basit bir HTTP sunucusuyla açmak en güvenlisi:

```bash
cd kings_game
python3 -m http.server 8000
# tarayıcıda aç: http://localhost:8000/index.html
```

## Proje yapısı

```
index.html        Bağımsız/Capacitor için tam HTML sayfası
artifact.html      Aynı oyunun "fragment" hâli (yayınlanan demo linki için)
css/style.css      Tüm stiller
js/config.js       Ayarlanabilir sabitler (hız, harita boyutu, vb.)
js/rng.js          Seed'lenebilir RNG + gürültü fonksiyonu (harita üretimi)
js/world.js        Harita üretimi + yerleşim yerleştirme
js/assets.js       Görsel yükleyici
js/camera.js       Kamera/görünüm dönüşümleri
js/input.js        Fare tık/sürükle (pan), klavye, dokunmatik joystick + pinch-zoom
js/party.js        Oyuncu ordusu (A* ile hareket, altın, asker tipleri, envanter, tutsaklık)
js/pathfind.js     A* yol bulma (harita engelleri etrafından en kısa yol)
js/economy.js      Yerleşim başına değişen/dalgalanan alış-satış fiyatları
js/npc.js          Tüccar/lord/eşkıya/kervan NPC'leri: üretim + gidiş-gel/kovalama AI'ı
js/time.js         Takvim/saat sistemi
js/render.js       Tüm çizim (harita, HUD, joystick, yerleşim/savaş menüleri, NPC'ler)
js/main.js         Oyun döngüsü ve durum makinesi (title/playing/settlement/battle ekranları)
generate_assets.py Piksel-art PNG'leri üreten script (Pillow)
assets/            Üretilen PNG'ler
tests/             Playwright ile otomatik duman testleri
```

## Yol haritası (sırayla eklenecek eklentiler)

1. **Savaş sisteminin derinleştirilmesi** — şu an sonuç anlık hesaplanıyor;
   ileride gerçek bir 2D top-down çarpışma ekranı (birlik konumlandırma,
   canlı çarpışma animasyonu) eklenebilir. Ayrıca kaçma/geri çekilme
   seçeneği ve lordlarla/diğer krallıklarla savaş.
2. **Görevler** — köylülerle konuşma ekranından tetiklenen basit
   görevler (şu an sadece atmosferik diyalog var).
3. **Karakter & envanter ekranı** — statlar, silah/zırh (artık ganimet
   olarak düşüyor ama ayrı bir "envanterim" ekranı yok, sadece pazar var).
4. **Krallıklar arası ilişkiler** — 7 krallık şu an sadece toprak sahibi;
   savaş durumu, diplomasi, ittifaklar henüz yok.
5. **Kayıt sistemi** genişletilmesi — birden fazla kayıt yuvası, gerçek "yeni
   oyun" menüsü.
6. **Ses & müzik, gerçek piksel font, daha büyük harita.**

Her eklenti bu proje yapısını bozmadan `js/` altına yeni modüller ve
`assets/` altına yeni PNG'ler eklenerek büyütülecek.

## Play Store'a çıkarma yolu (Capacitor)

Bu oyunun kendisi tamamen HTML/CSS/JS olduğu için, Play Store'a bir Android
uygulaması olarak paketlemenin en pratik yolu **Capacitor**'dür (oyun
kodunu değiştirmeden bir WebView uygulamasına sarar). Bunu kendi
bilgisayarında (internet erişimi olan bir ortamda) şu adımlarla yaparsın:

```bash
npm install -g @capacitor/cli
cd kings_game
npm init -y
npm install @capacitor/core @capacitor/android
npx cap init "KINGS" "com.seninadin.kings" --web-dir="."
npx cap add android
npx cap copy
npx cap open android   # Android Studio açılır, oradan APK/AAB üretilir
```

Play Store'a yüklemeden önce gerekli olacaklar (v0.1'de yok, ileride
ekleyeceğiz):
- Uygulama ikonu ve splash screen (Android boyutlarında).
- `versionCode` / `versionName` yönetimi.
- Gizlilik politikası linki (Play Console zorunlu kılıyor).
- İmzalama anahtarı (keystore) — Android Studio ile üretilir, **kaybetmemek
  çok önemli**, güncellemeler için tekrar gerekir.
- Ekran görüntüleri, mağaza açıklaması, içerik derecelendirmesi anketi.

Bu adımları bir sonraki eklentilerle birlikte, oyunun "gösterilecek hâli"
netleştikçe yapmak en mantıklısı — şimdi kod tarafına odaklanıyoruz.

## Test

`tests/` altında Playwright tabanlı iki duman testi var (başlangıç ekranı,
hareket, joystick, yerleşim yakınlığı, modal açma/kapama, duraklatma). Yeni
bir eklenti eklerken bunları genişletmek regresyonları erken yakalar.
