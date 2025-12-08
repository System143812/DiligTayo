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

struct PlantConfig {
  int plant_id;
  int plant_nickname;
  int soil_pin;
  int pump_pin;
  int auto_mode;
  int min_moist;
  int max_moist;
};

PlantConfig plants[10];
int plantSize = 0;

WebServer server(80);

DHT dht(DHTPIN, DHTTYPE);

unsigned long humidityMillis = 0;
unsigned long soilMillis = 0;

void updatePlantConfig() {
  HTTPClient http;
  http.begin(urlBase + "/api/getAllPlants");
  http.addHeader("Accept", "application/json");
  int responseCode = http.GET();
  if(responseCode != 200) Serial.println("Failed to get soil and pump pins");
  String payload = http.getString();
  StaticJsonDocument<2048>doc;
  DeserializationError err = deserializeJson(doc, payload);
  if(err) return Serial.println("Failed to parse json");
  JsonArray arr = doc.as<JsonArray>();
  plantSize = arr.size();
  for(int i = 0; i < plantSize; i++) {
    plants[i].plant_id = arr[i]["plant_id"];
    plants[i].plant_nickname = arr[i]["nickname"];
    plants[i].soil_pin = arr[i]["soil_pin"];
    plants[i].pump_pin = arr[i]["pump_pin"];
    plants[i].auto_mode = arr[i]["auto"];
    plants[i].min_moist = arr[i]["min_moisture"];
    plants[i].max_moist = arr[i]["max_moisture"];

    pinMode(plants[i].soil_pin, INPUT);
    pinMode(plants[i].pump_pin, OUTPUT);
  }
  server.send(200, "application/json", R"({"message":"Updated Plant Config"})");
  http.end();
}

float computeWaterAmount(int waterTimeSecs) {
  int mlPerSec = 5; //eto ung i-ccalibrate for better accuracy
  return floor((mlPerSec * waterTimeSecs) * 10) / 10;
}

float triggerWaterPump(int pump_pin, int soil_pin, int max_moist) {
  Serial.print("Watering the plant...");
  unsigned long start = millis();
  unsigned long current;
  unsigned long totalMillis;
  float moisture;
  digitalWrite(pump_pin, HIGH);
  moisture = floor((analogRead(soil_pin)) / 4095 * 1000.0) / 10;
  while(true) {
    if(moisture < max_moist) {
      if(millis() - start >= 1000) {
        moisture = floor((analogRead(soil_pin)) / 4095 * 1000.0) / 10;
        
      }
    } else {
      digitalWrite(pump_pin, LOW);
      totalMillis = millis() - start;
      break;
    }
  }
  unsigned long secs = totalMillis / 1000;
  return computeWaterAmount(secs);

}

void manualPump() {
  if(!server.hasArg("plain")) {
    server.send(400, "application/json", R"({"error":"No body"})");
    return;
  }
  StaticJsonDocument<728>doc;
  String body = server.arg("plain");
  DeserializationError err = deserializeJson(doc, body);
  float waterAmount = triggerWaterPump(doc["pump_pin"], doc["soil_pin"], doc["max_moist"]);
  StaticJsonDocument<128>res;
  res["amount"] = waterAmount;
  String json;
  serializeJson(res, json);
  server.send(200, "application/json", json);
}

void autoPump(int plant_id, String plant_nickname, int pump_pin, int soil_pin, int max_moist) {
  float waterAmount = triggerWaterPump(pump_pin, soil_pin, max_moist);
  HTTPClient http;

  StaticJsonDocument<728>doc;
  doc["plant_id"] = plant_id;
  doc["plant_nickname"] = plant_nickname;
  doc["amount"] = waterAmount;
  
  String json;
  serializeJson(doc, json);  
  http.begin(urlBase + "/api/esp/autoWater");
  http.addHeader("Content-Type", "application/json");
  int responseCode = http.POST(json);
  if(responseCode != 200) Serial.println("Server Error: Failed to show autowater event");
  http.end();
}

void updateHumidity() {
  if(millis() - humidityMillis >= 3000) {
    humidityMillis = millis();

    HTTPClient http;
    StaticJsonDocument<128>doc;
    float humidity = dht.readHumidity();
    doc["humidity"] = humidity;
    String json;
    serializeJson(doc, json);

    http.begin(urlBase + "/api/updateHumidity");
    http.addHeader("Content-Type", "application/json");

    int responseCode = http.POST(json);
    if(responseCode != 200) Serial.println("Failed to update humidity");
    http.end();
  }
}

void updateMoisture() {
  if(millis() - soilMillis >= 2000) {
    soilMillis = millis();
    StaticJsonDocument<2048>doc;
    JsonArray arr = doc.to<JsonArray>();

    for(int i = 0; i < plantSize; i++) {
      JsonObject obj = arr.add();
      float moisture = floor(analogRead(plants[i].soil_pin) / 4095 * 1000.0) / 10.0;
      obj["plant_id"] = plants[i].plant_id;
      obj["soil_pin"] = plants[i].soil_pin;
      obj["moisture"] = moisture;
      if(plants[i].min_moist >= moisture && plants[i].auto_mode == 1) {
        if(digitalRead(plants[i].pump_pin) == HIGH) {
          Serial.print(".");
        } else {
          autoPump(
            plants[i].plant_id,
            plants[i].plant_nickname,
            plants[i].pump_pin,
            plants[i].soil_pin, 
            plants[i].max_moist
          );
        }
      } 
    }
    HTTPClient http;
    http.begin(urlBase + "/api/updateMoisture");
    http.addHeader("Content-Type", "application/json");
    String json;
    serializeJson(doc, json);
    int responseCode = http.POST(json);
    if(responseCode != 200) Serial.println("Failed to update moisture");
    http.end();
  }
}

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

    //dito mga routes
    server.on("/api/esp/waterPump", HTTP_POST, manualPump);
    server.on("/api/esp/updatePlantConfig", HTTP_POST, updatePlantConfig);
    server.begin();
    updatePlantConfig();
    Serial.print("Esp server is now running on port: 80");
    dht.begin();
  }
}

void loop() {
  if(WiFi.status() == WL_CONNECTED) {
    server.handleClient();
    updateHumidity();
    updateMoisture();  
  } else {
    delay(2000);
    Serial.println("Network Connection Error...");
  }
}
