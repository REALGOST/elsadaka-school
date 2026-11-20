// تفعيل أزرار الواجهة فوراً (حتى قبل اتصال قاعدة البيانات)
let isPasswordVisible = false;

document.getElementById("togglePassText").addEventListener("click", function () {
    isPasswordVisible = !isPasswordVisible;
    document.getElementById("passwordFieldContainer").style.display = isPasswordVisible ? "block" : "none";
    document.getElementById("emailLinkBtn").style.display = isPasswordVisible ? "none" : "block";
    this.textContent = isPasswordVisible
        ? "العودة للدخول برابط الإيميل (Login with Email Link)"
        : "تسجيل الدخول بكلمة المرور (Login with password)";
});

document.getElementById("themeBtn").addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");
});

// إعدادات مشروع Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD1o37KUgl6QClFLpgNejT_ZZQhw1S9fPs",
    authDomain: "://firebaseapp.com",
    projectId: "elsadaka-school",
    storageBucket: "elsadaka-school.firebasestorage.app",
    messagingSenderId: "200899599812",
    appId: "1:200899599812:web:610e9569b886ec4d52d891"
};

// تشغيل Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const ADMIN_EMAIL = "mahraban2000@gmail.com";

// 1. الدخول بحساب Google
document.getElementById("btnGoogleLogin").addEventListener("click", async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        await setupUserRole(result.user);
    } catch (error) {
        alert("خطأ في الدخول بجوجل: " + error.message);
    }
});

// 2. إرسال رابط الدخول السريع للإيميل
document.getElementById("emailLinkBtn").addEventListener("click", async () => {
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    if (!email) return alert("يرجى إدخال بريدك الإلكتروني أولاً!");
    const actionCodeSettings = { url: window.location.href, handleCodeInApp: true };
    try {
        await auth.sendSignInLinkToEmail(email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        alert("تم إرسال رابط الدخول إلى بريدك الإلكتروني! افتح بريدك واضغط على الرابط.");
    } catch (error) {
        alert("خطأ: " + error.message);
    }
});

// التحقق عند فتح الموقع من رابط الإيميل
if (auth.isSignInWithEmailLink(window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn') || window.prompt('أدخل بريدك الإلكتروني للتأكيد:');
    auth.signInWithEmailLink(email, window.location.href).then(async (result) => {
        window.localStorage.removeItem('emailForSignIn');
        await setupUserRole(result.user);
    });
}

// 3. تسجيل الدخول بكلمة المرور
document.getElementById("btnLoginPass").addEventListener("click", async () => {
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    const pass = document.getElementById("passwordInput").value;
    if (!email || !pass) return alert("يرجى إدخال البريد الإلكتروني وكلمة المرور");
    try {
        const result = await auth.signInWithEmailAndPassword(email, pass);
        await setupUserRole(result.user);
    } catch (error) {
        alert("خطأ في الدخول: " + error.message);
    }
});

// 4. إنشاء حساب جديد بكلمة المرور
document.getElementById("btnSignupPass").addEventListener("click", async () => {
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    const pass = document.getElementById("passwordInput").value;
    if (!email || pass.length < 6) return alert("أدخل البريد الإلكتروني وكلمة مرور من 6 أحرف على الأقل");
    try {
        const result = await auth.createUserWithEmailAndPassword(email, pass);
        await setupUserRole(result.user);
    } catch (error) {
        alert("خطأ في إنشاء الحساب: " + error.message);
    }
});

// حفظ وتحديد دور المستخدم
async function setupUserRole(user) {
    const email = user.email.toLowerCase();
    const userRef = db.collection("users").doc(email);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        const role = (email === ADMIN_EMAIL) ? "admin" : document.getElementById("selectedRole").value;
        await userRef.set({ email: email, role: role, banned: false });
    }
}

// مراقبة حالة الدخول وتوجيه المستخدم
auth.onAuthStateChanged(async (user) => {
    const loginScreen = document.getElementById("loginScreen");
    const mainApp = document.getElementById("mainAppContent");
    const bannedScreen = document.getElementById("bannedScreen");

    loginScreen.style.display = "none";
    mainApp.style.display = "none";
    bannedScreen.style.display = "none";

    if (!user) {
        loginScreen.style.display = "flex";
        return;
    }

    const email = user.email.toLowerCase();
    document.querySelectorAll(".user-email-display").forEach(el => el.textContent = email);

    const userSnap = await db.collection("users").doc(email).get();
    const userData = userSnap.exists ? userSnap.data() : { role: email === ADMIN_EMAIL ? "admin" : "student", banned: false };

    if (userData.banned && email !== ADMIN_EMAIL) {
        bannedScreen.style.display = "flex";
        return;
    }

    mainApp.style.display = "block";
    document.getElementById("studentPanel").style.display = "none";
    document.getElementById("teacherPanel").style.display = "none";
    document.getElementById("adminPanel").style.display = "none";

    if (email === ADMIN_EMAIL || userData.role === "admin") {
        document.getElementById("adminPanel").style.display = "block";
    } else if (userData.role === "teacher") {
        document.getElementById("teacherPanel").style.display = "block";
        loadChat();
    } else {
        document.getElementById("studentPanel").style.display = "block";
        loadStudentData(email);
        loadChat();
    }
});

// تسجيل الخروج
document.getElementById("btnLogoutMain").addEventListener("click", () => auth.signOut());
document.getElementById("btnLogoutBanned").addEventListener("click", () => auth.signOut());

// وظائف المعلم والمدير
document.getElementById("btnSaveEval").addEventListener("click", async () => {
    const studentEmail = document.getElementById("targetStudentEmail").value.trim().toLowerCase();
    const text = document.getElementById("teacherEvalText").value;
    if (!studentEmail || !text) return alert("أدخل إيميل التلميذ والتقييم");
    await db.collection("evaluations").doc(studentEmail).set({ text: text, updatedBy: "المعلم" });
    alert("تم حفظ التقييم بنجاح!");
});

document.getElementById("btnAdminEval").addEventListener("click", async () => {
    const studentEmail = document.getElementById("adminTargetStudent").value.trim().toLowerCase();
    const text = document.getElementById("adminOverrideEval").value;
    if (!studentEmail || !text) return alert("أدخل إيميل التلميذ والتقييم");
    await db.collection("evaluations").doc(studentEmail).set({ text: text + " (مُعدّل بواسطة الإدارة)", updatedBy: "المدير" });
    alert("تم تعديل التقييم إجبارياً!");
});

document.getElementById("btnPublishVideo").addEventListener("click", async () => {
    const title = document.getElementById("videoTitle").value;
    const url = document.getElementById("videoUrl").value;
    if (!title || !url) return alert("أدخل عنوان الفيديو ورابطه");
    await db.collection("videos").add({ title: title, url: url, createdAt: Date.now() });
    alert("تم نشر الفيديو للطلاب!");
});

async function toggleBan(banStatus) {
    const target = document.getElementById("banTargetEmail").value.trim().toLowerCase();
    if (!target || target === ADMIN_EMAIL) return alert("لا يمكن حظر هذا الحساب!");
    await db.collection("users").doc(target).set({ banned: banStatus }, { merge: true });
    alert(banStatus ? `تم حظر ${target}` : `تم فك الحظر عن ${target}`);
}

document.getElementById("btnBanUser").addEventListener("click", () => toggleBan(true));
document.getElementById("btnUnbanUser").addEventListener("click", () => toggleBan(false));

function loadStudentData(email) {
    db.collection("evaluations").doc(email).onSnapshot((docSnap) => {
        document.getElementById("studentEvaluationBox").textContent = docSnap.exists ? docSnap.data().text : "لا يوجد تقييم حالياً.";
    });
    db.collection("videos").onSnapshot((snapshot) => {
        const list = document.getElementById("studentVideosList");
        list.innerHTML = "";
        snapshot.forEach((doc) => {
            const v = doc.data();
            list.innerHTML += `<p>🎬 <strong>${v.title}:</strong> <a href="${v.url}" target="_blank">مشاهدة الفيديو</a></p>`;
        });
    });
}

async function sendChat(senderRole) {
    const inputId = senderRole === "تلميذ" ? "studentMsgText" : "teacherMsgText";
    const msg = document.getElementById(inputId).value.trim();
    if (!msg) return;
    await db.collection("messages").add({
        sender: `${senderRole} (${auth.currentUser.email})`,
        text: msg,
        timestamp: Date.now()
    });
    document.getElementById(inputId).value = "";
}

document.getElementById("btnSendStudentMsg").addEventListener("click", () => sendChat("تلميذ"));
document.getElementById("btnSendTeacherMsg").addEventListener("click", () => sendChat("المعلم"));

function loadChat() {
    db.collection("messages").orderBy("timestamp").onSnapshot((snapshot) => {
        let html = "";
        snapshot.forEach((doc) => {
            html += `<p><strong>${doc.data().sender}:</strong> ${doc.data().text}</p>`;
        });
        document.getElementById("studentChatMessages").innerHTML = html;
        document.getElementById("teacherChatMessages").innerHTML = html;
    });
}
