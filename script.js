import { initializeApp } from "https://gstatic.com";
import { getAuth, signInWithPopup, GoogleAuthProvider, OAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut } from "https://gstatic.com";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy } from "https://gstatic.com";

const firebaseConfig = {
    apiKey: "AIzaSyD1o37KUgl6QClFLpgNejT_ZZQhw1S9fPs",
    authDomain: "://firebaseapp.com",
    projectId: "elsadaka-school",
    storageBucket: "elsadaka-school.firebasestorage.app",
    messagingSenderId: "200899599812",
    appId: "1:200899599812:web:610e9569b886ec4d52d891",
    measurementId: "G-97WQRLE080"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = "mahraban2000@gmail.com";
let authMode = "login";
let isPasswordVisible = false;

window.setAuthMode = (mode) => { authMode = mode; };
window.toggleTheme = () => { document.body.classList.toggle("dark-mode"); };

// التبديل بين زر رابط الدخول وحقل كلمة المرور
window.togglePasswordMode = () => {
    isPasswordVisible = !isPasswordVisible;
    document.getElementById("passwordFieldContainer").style.display = isPasswordVisible ? "block" : "none";
    document.getElementById("emailLinkBtn").style.display = isPasswordVisible ? "none" : "block";
    document.getElementById("togglePassText").textContent = isPasswordVisible 
        ? "العودة للدخول برابط الإيميل (Login with Email Link)" 
        : "تسجيل الدخول بكلمة المرور (Login with password)";
};

// إرسال رابط الدخول السريع للإيميل (Email Me Login Link)
window.sendMagicLink = async () => {
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    if (!email) return alert("يرجى إدخال بريدك الإلكتروني أولاً!");
    const actionCodeSettings = { url: window.location.href, handleCodeInApp: true };
    try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        alert("تم إرسال رابط الدخول إلى بريدك الإلكتروني! افتح بريدك واضغط على الرابط.");
    } catch (error) { alert("خطأ: " + error.message); }
};

// التحقق إذا فتح المستخدم الصفحة من رابط الإيميل
if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn') || window.prompt('أدخل بريدك الإلكتروني للتأكيد:');
    signInWithEmailLink(auth, email, window.location.href).then(async (result) => {
        window.localStorage.removeItem('emailForSignIn');
        await setupUserRole(result.user);
    });
}

// الدخول بجوجل
window.loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await setupUserRole(result.user);
    } catch (error) { alert("خطأ في الدخول بجوجل: " + error.message); }
};

// الدخول بأبل
window.loginWithApple = async () => {
    try {
        const result = await signInWithPopup(auth, new OAuthProvider('apple.com'));
        await setupUserRole(result.user);
    } catch (error) { alert("يتطلب حساب مطورين Apple مفعل في Firebase."); }
};

// الدخول أو إنشاء حساب بكلمة مرور
window.handleAuthSubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    const pass = document.getElementById("passwordInput").value;
    if (!pass) return alert("يرجى إدخال كلمة المرور");
    try {
        const result = authMode === "signup"
            ? await createUserWithEmailAndPassword(auth, email, pass)
            : await signInWithEmailAndPassword(auth, email, pass);
        await setupUserRole(result.user);
    } catch (error) { alert("خطأ: " + error.message); }
};

async function setupUserRole(user) {
    const email = user.email.toLowerCase();
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        const role = (email === ADMIN_EMAIL) ? "admin" : document.getElementById("selectedRole").value;
        await setDoc(userRef, { email: email, role: role, banned: false });
    }
}

// التحكم في إظهار واجهة الدخول أو محتوى الموقع
onAuthStateChanged(auth, async (user) => {
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

    const userSnap = await getDoc(doc(db, "users", email));
    const userData = userSnap.exists() ? userSnap.data() : { role: email === ADMIN_EMAIL ? "admin" : "student", banned: false };

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

window.logoutUser = () => signOut(auth);

window.saveEvaluation = async () => {
    const studentEmail = document.getElementById("targetStudentEmail").value.trim().toLowerCase();
    const text = document.getElementById("teacherEvalText").value;
    if (!studentEmail || !text) return alert("أدخل إيميل التلميذ والتقييم");
    await setDoc(doc(db, "evaluations", studentEmail), { text: text, updatedBy: "المعلم" });
    alert("تم حفظ التقييم بنجاح!");
};

window.adminUpdateEval = async () => {
    const studentEmail = document.getElementById("adminTargetStudent").value.trim().toLowerCase();
    const text = document.getElementById("adminOverrideEval").value;
    if (!studentEmail || !text) return alert("أدخل إيميل التلميذ والتقييم");
    await setDoc(doc(db, "evaluations", studentEmail), { text: text + " (مُعدّل بواسطة الإدارة)", updatedBy: "المدير" });
    alert("تم تعديل التقييم إجبارياً!");
};

window.publishVideo = async () => {
    const title = document.getElementById("videoTitle").value;
    const url = document.getElementById("videoUrl").value;
    if (!title || !url) return alert("أدخل عنوان الفيديو ورابطه");
    await addDoc(collection(db, "videos"), { title: title, url: url, createdAt: Date.now() });
    alert("تم نشر الفيديو للطلاب!");
};

window.toggleBanUser = async (banStatus) => {
    const target = document.getElementById("banTargetEmail").value.trim().toLowerCase();
    if (!target || target === ADMIN_EMAIL) return alert("لا يمكن حظر هذا الحساب!");
    await setDoc(doc(db, "users", target), { banned: banStatus }, { merge: true });
    alert(banStatus ? `تم حظر ${target}` : `تم فك الحظر عن ${target}`);
};

function loadStudentData(email) {
    onSnapshot(doc(db, "evaluations", email), (docSnap) => {
        document.getElementById("studentEvaluationBox").textContent = docSnap.exists() ? docSnap.data().text : "لا يوجد تقييم حالياً.";
    });
    onSnapshot(collection(db, "videos"), (snapshot) => {
        const list = document.getElementById("studentVideosList");
        list.innerHTML = "";
        snapshot.forEach((doc) => {
            const v = doc.data();
            list.innerHTML += `<p>🎬 <strong>${v.title}:</strong> <a href="${v.url}" target="_blank">مشاهدة الفيديو</a></p>`;
        });
    });
}

window.sendChatMessage = async (senderRole) => {
    const inputId = senderRole === "تلميذ" ? "studentMsgText" : "teacherMsgText";
    const msg = document.getElementById(inputId).value.trim();
    if (!msg) return;
    await addDoc(collection(db, "messages"), { sender: `${senderRole} (${auth.currentUser.email})`, text: msg, timestamp: Date.now() });
    document.getElementById(inputId).value = "";
};

function loadChat() {
    const q = query(collection(db, "messages"), orderBy("timestamp"));
    onSnapshot(q, (snapshot) => {
        let html = "";
        snapshot.forEach((doc) => { html += `<p><strong>${doc.data().sender}:</strong> ${doc.data().text}</p>`; });
        document.getElementById("studentChatMessages").innerHTML = html;
        document.getElementById("teacherChatMessages").innerHTML = html;
    });
}
