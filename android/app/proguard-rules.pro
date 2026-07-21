# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Preserve production stack traces and runtime annotations used by Capacitor,
# Room, and Kotlin metadata.
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,AnnotationDefault

# If you keep the line number information, uncomment this to
# hide the original source file name.
-renamesourcefileattribute SourceFile

# --- Capacitor plugin bridge -------------------------------------------------
# Capacitor resolves plugin metadata reflectively at runtime by reading the
# @CapacitorPlugin annotation. R8 removed those annotation types, so
# PluginHandle.getPluginAnnotation() returned null and the first
# getPermissionState("camera") call crashed the release build with an NPE while
# debug builds were fine. Keep the annotation types themselves and every plugin
# member Capacitor looks up by reflection.
-keep @interface com.getcapacitor.annotation.**
-keep class com.getcapacitor.annotation.** { *; }

-keep @com.getcapacitor.annotation.CapacitorPlugin public class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    public <init>(...);
}

# This app's own plugin and the classes it exchanges with the WebView.
-keep class ua.alexsnig.exhibitmotion.detector.MotionDetectorPlugin { *; }
-keep class ua.alexsnig.exhibitmotion.MainActivity { *; }

# Capacitor core reflection surface.
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod <methods>;
}
-dontwarn com.getcapacitor.**
