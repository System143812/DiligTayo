#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT22

const char* ssid = "ssid";
const char* password = "wifipass";
String urlBase = "http://192.168.8.142:3007"; //pang local lang to ah

DHT dht(DHTPIN, DHTTYPE);

unsigned long lastMillis = 0;

void setup() {
  Serial.begin(115200);
  delay(500);

  WiFi.begin(ssid, password);
  Serial.print("Connecting");
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED) {
    if(attempt >= 40) break;
    Serial.print(".");
    delay(500);
    attempt++;
  }

  if(attempt >= 40) {
    Serial.println("");
    Serial.println("Failed to connect to the Network");
  } else {
    Serial.println("");
    Serial.print("Connected Successfully ");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    dht.begin();
  }
  
}

void loop() {
  if(WiFi.status() == WL_CONNECTED) {
    updateHumidity();  
  } else {
    delay(2000);
    Serial.println("Network Connection Error...");
  }
}

void updateHumidity() {
  if(millis() - lastMillis >= 3000) {
    lastMillis = millis();

    HTTPClient http;
    StaticJsonDocument<128>doc;
    float humidity = dht.readHumidity();
    doc["humidity"] = humidity;
    String json;
    serializeJson(doc, json);

    http.begin(urlBase + "/api/updateHumidity");
    http.addHeader("Content-Type", "application/json");

    int responseCode = http.POST(json);
    String response = http.getString();

    Serial.print("Response Code: ");
    Serial.println(responseCode);
    Serial.print("Server Response: ");
    Serial.println(response);   

    http.end();

  }
}