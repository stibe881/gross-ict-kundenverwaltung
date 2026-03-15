const fs = require('fs');
let c = fs.readFileSync('app/(tabs)/tickets.tsx', 'utf8');

c = c.replace(
`                        {currentPriority === opt.key && <IconSymbol name="checkmark" size={14} color={opt.color} />}
                      </TouchableOpacity>
                               {/* ── Tabs (Kommentare vs. Aufwände) ── */}`,
`                        {currentPriority === opt.key && <IconSymbol name="checkmark" size={14} color={opt.color} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Tabs (Kommentare vs. Aufwände) ── */}`
);

c = c.replace(
`                />
              )})}
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </ScrollView>`,
`                />
              )}
            </View>
          </ScrollView>`
);

fs.writeFileSync('app/(tabs)/tickets.tsx', c);
console.log('Fixed syntax errors.');
